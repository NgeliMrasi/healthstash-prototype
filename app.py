from flask import Flask, render_template, request, jsonify
from stellar_sdk import Server, Keypair, TransactionBuilder, Network, Asset
import os
import requests

cat > app.py << 'EOF'
from flask import Flask, render_template, request, jsonify
from stellar_sdk import Server, Keypair, TransactionBuilder, Network, Asset
import os
import requests
# Update app.py with the specific keys
cat > app.py << 'EOF'
from flask import Flask, render_template, request, jsonify
from stellar_sdk import Server, Keypair, TransactionBuilder, Network, Asset
import os
import requests

app = Flask(__name__)

# Use Stellar Testnet
server = Server("https://horizon-testnet.stellar.org")
network_passphrase = Network.TESTNET_NETWORK_PASSPHRASE

# --- Define the specific keypairs you generated ---
# Issuer Keypair (Set 2)
issuer_secret_key = "SDDEGJVAM3N6I4VEHHYMIMBHOGATXP6CYEBGC7XPVC2MU2H755GNA5ZN"
issuer_keypair = Keypair.from_secret(issuer_secret_key)
issuer_public_key = issuer_keypair.public_key

# Define the Randela asset (issued by the issuer keypair)
randela_asset = Asset("Randela", issuer_public_key)

# User Keypair (Set 2)
user_secret_key = "SABFMKSFZGZEEEVDGSCFW4TV5SHUVIHSAXNYJFBPRJHDBEJ36RH74KKG"
user_keypair = Keypair.from_secret(user_secret_key)
user_public_key = user_keypair.public_key

# Merchant Keypair (Set 2)
merchant_secret_key = "SCQUYGLTX5ILUM2EUP4BUF7IORXZJBBMHY3XLUS5UIJGE4KLPUHHLVWO"
merchant_keypair = Keypair.from_secret(merchant_secret_key)
merchant_public_key = merchant_keypair.public_key

# --- Funding is now assumed to be done manually via Friendbot ---
print("Using predefined keypairs for Issuer, User, and Merchant.")
print(f"Issuer Public Key: {issuer_public_key}")
print(f"User Public Key: {user_public_key}")
print(f"Merchant Public Key: {merchant_public_key}")

# Function to mint Randela by the issuer and send to the user
def mint_randela_to_user(amount):
    try:
        # Load the issuer account
        issuer_account = server.load_account(issuer_public_key)
        
        # Build the transaction to send Randela from issuer to user
        transaction = (
            TransactionBuilder(
                source_account=issuer_account,
                network_passphrase=network_passphrase,
                base_fee=100,
            )
            .append_payment_op(
                destination=user_public_key,
                amount=amount,
                asset=randela_asset,
            )
            .set_timeout(30)
        )
        
        # Sign the transaction with the issuer's secret key
        transaction.sign(issuer_keypair)
        
        # Submit the transaction
        response = server.submit_transaction(transaction.build())
        print(f"Minting transaction successful: {response['hash']}")
        return True, response['hash']
    except Exception as e:
        print(f"Error minting Randela: {e}")
        return False, str(e)

# Function to pay the merchant from the user's wallet
def pay_merchant(amount):
    try:
        # Load the user account
        user_account = server.load_account(user_public_key)
        
        # Build the transaction to send Randela from user to merchant
        transaction = (
            TransactionBuilder(
                source_account=user_account,
                network_passphrase=network_passphrase,
                base_fee=100,
            )
            .append_payment_op(
                destination=merchant_public_key,
                amount=amount,
                asset=randela_asset,
            )
            .set_timeout(30)
        )
        
        # Sign the transaction with the user's secret key
        transaction.sign(user_keypair)
        
        # Submit the transaction
        response = server.submit_transaction(transaction.build())
        print(f"Payment transaction successful: {response['hash']}")
        return True, response['hash']
    except Exception as e:
        print(f"Error paying merchant: {e}")
        return False, str(e)

# Get the user's Randela balance
def get_user_balance():
    try:
        account_details = server.accounts().account_id(user_public_key).call()
        balances = account_details.get("balances")
        for balance in balances:
            if balance.get("asset_code") == randela_asset.code and balance.get("asset_issuer") == randela_asset.issuer:
                return float(balance.get("balance"))
        return 0.0
    except Exception as e:
        print(f"Error fetching balance: {e}")
        return 0.0

# Route to serve the main page
@app.route('/')
def index():
    balance = get_user_balance()
    return render_template('index.html', balance=balance, user_address=user_public_key, merchant_address=merchant_public_key)

# Route to handle deposit (simulate minting Randela)
@app.route('/deposit', methods=['POST'])
def deposit():
    data = request.json
    amount = data.get('amount', 0)
    success, message = mint_randela_to_user(str(amount))
    if success:
        return jsonify({"success": True, "message": f"Successfully minted {amount} Randela(s)", "new_balance": get_user_balance()})
    else:
        return jsonify({"success": False, "message": f"Failed to mint Randela: {message}"})

# Route to handle spending (pay merchant)
@app.route('/spend', methods=['POST'])
def spend():
    data = request.json
    amount = data.get('amount', 0)
    success, message = pay_merchant(str(amount))
    if success:
        return jsonify({"success": True, "message": f"Successfully paid {amount} Randela(s) to merchant", "new_balance": get_user_balance()})
    else:
        return jsonify({"success": False, "message": f"Failed to pay merchant: {message}"})

# Use the PORT environment variable provided by the hosting platform, default to 5000
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False) # Set debug=False for deployment

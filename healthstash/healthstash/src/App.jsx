"use client";
import React, { useState, useEffect } from 'react';
import * as StellarSdk from 'stellar-sdk';
import QRCode from 'qrcode.react';
import {
  Container,
  Paper,
  Typography,
  Button,
  TextField,
  Box,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  AccountCircle,
  Payment,
  Dashboard,
  QrCode2,
  Send,
  ContentCopy,
  DirectionsRun,
} from '@mui/icons-material';
import '@emotion/react';
import '@emotion/styled';

// Stellar network configuration (Testnet for zero-cost dev)
StellarSdk.Network.useTestNetwork();
const server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
const ZARC_ISSUER_PUBLIC_KEY = 'GC4HS4CQCOVTOJZMBCQ4OXLQJ2KEOC4CD6T3KGZFHBNMHFWGA4AXGXBK';
const zarcAsset = new StellarSdk.Asset('ZARC', ZARC_ISSUER_PUBLIC_KEY);

// Utility for copying text to clipboard
const copyToClipboard = (text) => {
  const el = document.createElement('textarea');
  el.value = text;
  document.body.appendChild(el);
  document.execCommand('copy');
  document.body.removeChild(el);
};

const App = () => {
  // State for user wallet and account information
  const [keypair, setKeypair] = useState(null);
  const [balance, setBalance] = useState(0);
  const [isAccountFunded, setIsAccountFunded] = useState(false);
  const [kycVerified, setKycVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // State for payment functionality
  const [paymentAmount, setPaymentAmount] = useState('');
  const [qrValue, setQrValue] = useState('');
  const [destinationKey, setDestinationKey] = useState('');
  const [sendAmount, setSendAmount] = useState('');

  // State for the simplified employer dashboard
  const [employerSecret, setEmployerSecret] = useState('');
  const [recipientsInput, setRecipientsInput] = useState('');
  const [disbursementStatus, setDisbursementStatus] = useState('');

  // Hook to automatically load account data and balance
  useEffect(() => {
    const fetchAccountInfo = async () => {
      if (!keypair) return;

      try {
        const account = await server.loadAccount(keypair.publicKey());
        const zarcBalance = account.balances.find(
          (b) => b.asset_code === 'ZARC' && b.asset_issuer === ZARC_ISSUER_PUBLIC_KEY
        );
        setBalance(zarcBalance ? zarcBalance.balance : 0);
        setIsAccountFunded(true);
      } catch (e) {
        console.error('Account not found or unfunded:', e);
        setIsAccountFunded(false);
      }
    };
    fetchAccountInfo();
  }, [keypair]);

  // Function to create a new wallet keypair
  const handleCreateWallet = async () => {
    setLoading(true);
    setStatusMessage('Creating wallet...');
    try {
      const newKeypair = StellarSdk.Keypair.random();
      setKeypair(newKeypair);
      setStatusMessage('Wallet created! Funding with Friendbot...');

      // Friendbot for testnet funding
      await fetch(`https://friendbot.stellar.org/?addr=${newKeypair.publicKey()}`);
      setStatusMessage('Account funded. Establishing trustline...');

      // Establish trustline to ZARC asset
      const account = await server.loadAccount(newKeypair.publicKey());
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          StellarSdk.Operation.changeTrust({
            asset: zarcAsset,
            limit: '1000000000',
          })
        )
        .setTimeout(30)
        .build();
      tx.sign(newKeypair);
      await server.submitTransaction(tx);
      setStatusMessage('Trustline established! You are ready to receive ZARC.');
      setIsAccountFunded(true);

      // Mock KYC check
      setKycVerified(true);
      setStatusMessage('KYC check mocked and approved. Ready!');
    } catch (e) {
      console.error('Error during wallet creation:', e);
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to generate a QR code for receiving funds
  const handleGenerateQR = () => {
    if (!keypair) {
      alert('Please create or import a wallet first.');
      return;
    }
    if (paymentAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    const uri = `web+stellar:pay?destination=${keypair.publicKey()}&asset=ZARC&amount=${paymentAmount}`;
    setQrValue(uri);
  };

  // Function to send a payment
  const handleSendPayment = async () => {
    if (!keypair || !isAccountFunded) {
      alert('Please create a wallet and fund it before sending payments.');
      return;
    }
    if (!destinationKey || !sendAmount || isNaN(sendAmount) || parseFloat(sendAmount) <= 0) {
      alert('Please enter a valid destination key and amount.');
      return;
    }

    setLoading(true);
    setStatusMessage('Sending payment...');
    try {
      const account = await server.loadAccount(keypair.publicKey());
      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          StellarSdk.Operation.payment({
                destination: destinationKey,
                asset: zarcAsset,
                amount: sendAmount.toString(),
          })
        )
        .setTimeout(30)
        .build();
      transaction.sign(keypair);
      await server.submitTransaction(transaction);
      setStatusMessage('Payment successful! Transaction submitted.');
      setDestinationKey('');
      setSendAmount('');
    } catch (e) {
      console.error('Payment error:', e);
      setStatusMessage(`Payment failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to handle simplified bulk disbursements
  const handleDisburse = async () => {
    if (!employerSecret || !recipientsInput) {
      setDisbursementStatus('Please provide employer secret and recipient data.');
      return;
    }

    setLoading(true);
    setDisbursementStatus('Processing bulk disbursement...');

    // Mock AML check - just a log
    console.log(`[AML Check Mock] Disbursement flagged for review (total amount > R10,000): ${recipientsInput}`);

    try {
      const employerKeypair = StellarSdk.Keypair.fromSecret(employerSecret);
      const employerAccount = await server.loadAccount(employerKeypair.publicKey());
      const txBuilder = new StellarSdk.TransactionBuilder(employerAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      });

      // Parse recipients from text area
      const recipients = recipientsInput
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line)
        .map((line) => {
          const [publicKey, amount] = line.split(',');
          return { publicKey: publicKey.trim(), amount: amount.trim() };
        });

      recipients.forEach((recipient) => {
        txBuilder.addOperation(
          StellarSdk.Operation.payment({
            destination: recipient.publicKey,
            asset: zarcAsset,
            amount: recipient.amount,
          })
        );
      });

      const transaction = txBuilder.setTimeout(30).build();
      transaction.sign(employerKeypair);
      await server.submitTransaction(transaction);

      setDisbursementStatus('Bulk disbursement successful!');
    } catch (e) {
      console.error('Disbursement error:', e);
      setDisbursementStatus(`Disbursement failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" className="min-h-screen bg-gray-100 flex items-center justify-center p-4 sm:p-8">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .MuiTextField-root { width: 100%; }
        .MuiButton-root { width: 100%; }
      `}</style>
      <script src="https://cdn.tailwindcss.com"></script>
      <Box className="w-full max-w-4xl p-8 bg-white shadow-xl rounded-2xl flex flex-col lg:flex-row space-y-8 lg:space-y-0 lg:space-x-8">
        {/* Left Side: Wallet & Payments */}
        <Paper className="p-6 md:p-8 rounded-xl flex-1 flex flex-col space-y-6">
          <Box className="flex justify-center mb-4">
            <img src="https://placehold.co/200x50/e0e0e0/gray?text=HealthStash+Logo" alt="HealthStash Logo" className="w-48 h-auto" />
          </Box>
          <Typography variant="subtitle1" className="text-center text-gray-500">
            A zero-cost MVP built on Stellar Testnet.
          </Typography>
          <hr className="my-4 border-gray-200" />

          {/* Wallet Section */}
          <Box>
            <Typography variant="h6" className="text-gray-700 flex items-center mb-4">
              <AccountCircle className="mr-2" /> My Wallet
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={handleCreateWallet}
              disabled={loading}
              className="mt-4"
              sx={{ py: 2 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Create/Connect Wallet'}
            </Button>
            {keypair && (
              <Box className="mt-4 p-4 bg-gray-100 rounded-lg shadow-inner">
                <Typography className="text-sm break-all text-gray-600 mb-2">
                  <span className="font-semibold text-gray-800">Public Key:</span> {keypair.publicKey()}
                  <Tooltip title="Copy Public Key">
                    <IconButton onClick={() => copyToClipboard(keypair.publicKey())} size="small" sx={{ ml: 1 }}>
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Typography>
                <Typography className="text-sm break-all text-gray-600">
                  <span className="font-semibold text-gray-800">Secret Key:</span> {keypair.secret()}
                  <Tooltip title="Copy Secret Key">
                    <IconButton onClick={() => copyToClipboard(keypair.secret())} size="small" sx={{ ml: 1 }}>
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Typography>
                <Alert severity="warning" className="mt-4">
                  This is your secret key! Back it up and do not share it.
                </Alert>
              </Box>
            )}
            {statusMessage && <Alert severity="info" className="mt-4">{statusMessage}</Alert>}
          </Box>

          <hr className="my-4 border-gray-200" />

          {/* Dashboard Section */}
          <Box className="mt-6">
            <Typography variant="h6" className="text-gray-700 flex items-center mb-4">
              <Dashboard className="mr-2" /> Dashboard
            </Typography>
            <Paper className="p-4 bg-purple-50 text-purple-900 rounded-lg">
              <Typography variant="body1" className="font-bold">
                Your HealthStash Balance:
              </Typography>
              <Typography variant="h4" className="font-extrabold mt-1">
                {balance} ZARC
              </Typography>
            </Paper>
            <Box className="mt-4 flex flex-col space-y-2">
              <Alert severity={kycVerified ? 'success' : 'info'}>
                <span className="font-bold">KYC Status:</span> {kycVerified ? 'Verified' : 'Pending'} (Mocked)
              </Alert>
              <Alert severity="info">
                <span className="font-bold">Compliance:</span> AML checks are logged to the console (Mocked).
              </Alert>
            </Box>
          </Box>

          <hr className="my-4 border-gray-200" />

          {/* Payments Section */}
          <Box className="mt-6">
            <Typography variant="h6" className="text-gray-700 flex items-center mb-4">
              <Payment className="mr-2" /> Payments
            </Typography>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Receive Funds */}
              <Paper className="p-4 rounded-lg bg-teal-50 border border-teal-200">
                <Typography variant="subtitle1" className="font-semibold flex items-center mb-3 text-teal-800">
                  <QrCode2 className="mr-2" /> Receive Funds
                </Typography>
                <TextField
                  label="Amount"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  variant="outlined"
                  size="small"
                  fullWidth
                  className="mb-3"
                />
                <Button variant="contained" color="success" onClick={handleGenerateQR} className="w-full">
                  Generate QR
                </Button>
                {qrValue && (
                  <Box className="mt-4 flex justify-center">
                    <QRCode value={qrValue} size={150} />
                  </Box>
                )}
              </Paper>
              {/* Send Funds */}
              <Paper className="p-4 rounded-lg bg-sky-50 border border-sky-200">
                <Typography variant="subtitle1" className="font-semibold flex items-center mb-3 text-sky-800">
                  <Send className="mr-2" /> Send Funds
                </Typography>
                <TextField
                  label="Destination Public Key"
                  value={destinationKey}
                  onChange={(e) => setDestinationKey(e.target.value)}
                  variant="outlined"
                  size="small"
                  fullWidth
                  className="mb-3"
                />
                <TextField
                  label="Amount"
                  type="number"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  variant="outlined"
                  size="small"
                  fullWidth
                  className="mb-3"
                />
                <Button variant="contained" color="secondary" onClick={handleSendPayment} disabled={loading} className="w-full">
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Pay ZARC'}
                </Button>
              </Paper>
            </div>
          </Box>
        </Paper>

        {/* Right Side: Employer Dashboard */}
        <Paper className="p-6 md:p-8 rounded-xl flex-1 flex flex-col space-y-6">
          <Typography variant="h5" component="h2" className="text-center font-bold text-gray-800 mb-4">
            Employer Dashboard
          </Typography>
          <Typography variant="subtitle1" className="text-center text-gray-500">
            Simplified bulk disbursements.
          </Typography>
          <hr className="my-4 border-gray-200" />

          <Box>
            <Typography variant="h6" className="text-gray-700 flex items-center mb-4">
              <Dashboard className="mr-2" /> Bulk Pay
            </Typography>
            <TextField
              label="Employer Secret Key"
              value={employerSecret}
              onChange={(e) => setEmployerSecret(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
              className="mb-3"
              multiline
              minRows={1}
            />
            <TextField
              label="Recipients (PublicKey,Amount)"
              placeholder="e.g.&#10;GABC...XYZ,100&#10;GDEF...UVW,50"
              value={recipientsInput}
              onChange={(e) => setRecipientsInput(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
              multiline
              rows={4}
              className="mb-3"
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleDisburse}
              disabled={loading}
              sx={{ py: 2 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Disburse Funds'}
            </Button>
            {disbursementStatus && <Alert severity="info" className="mt-4">{disbursementStatus}</Alert>}
          </Box>
        </Paper>
        <Box className="absolute bottom-4 right-4 text-gray-500 text-sm flex items-center space-x-2">
          <DirectionsRun fontSize="small" />
          <p>Powered by Stellar</p>
        </Box>
      </Box>
    </Container>
  );
};

export default App;

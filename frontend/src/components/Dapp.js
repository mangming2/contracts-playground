import React, { useState, useEffect, useCallback } from "react";

// We'll use ethers to interact with the Ethereum network and our contract
import { ethers } from "ethers";
import { BrowserProvider } from 'ethers';

// We import the contract's artifacts and address here, as we are going to be
// using them with ethers
import TokenArtifact from "../contracts/FHERC20.json";
import contractAddress from "../contracts/FHERC20_DEPLOY.json";

import { FhenixClient, getPermit } from "fhenixjs";

// All the logic of this dapp is contained in the Dapp component.
// These other components are just presentational ones: they don't have any
// logic. They just render HTML.
import { NoWalletDetected } from "./NoWalletDetected";
import { ConnectWallet } from "./ConnectWallet";
import { Loading } from "./Loading";
import { Transfer } from "./Transfer";
import { TransactionErrorMessage } from "./TransactionErrorMessage";
import { WaitingForTransactionMessage } from "./WaitingForTransactionMessage";
import { NoTokensMessage } from "./NoTokensMessage";

// This is the default id used by the Hardhat Network
const HARDHAT_NETWORK_ID = 412346;

// This is an error code that indicates that the user canceled a transaction
const ERROR_CODE_TX_REJECTED_BY_USER = 4001;

// This component is in charge of doing these things:
//   1. It connects to the user's wallet
//   2. Initializes ethers and the Token contract
//   3. Polls the user balance to keep it updated.
//   4. Transfers tokens by sending transactions
//   5. Renders the whole application
//
// Note that (3) and (4) are specific of this sample application, but they show
// you how to keep your Dapp and contract's state in sync,  and how to send a
// transaction.
export function Dapp() {
  const [selectedAddress, setSelectedAddress] = useState(undefined);
  const [tokenData, setTokenData] = useState(undefined);
  const [balance, setBalance] = useState(undefined);
  const [txBeingSent, setTxBeingSent] = useState(undefined);
  const [transactionError, setTransactionError] = useState(undefined);
  const [networkError, setNetworkError] = useState(undefined);
  const [contract, setContract] = useState(undefined);
  const [fhenixClient, setFhenixClient] = useState(undefined);
  const [permit, setPermit] = useState(undefined);

  useEffect(() => {
    if (window.ethereum === undefined) {
      return;
    }

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        resetState();
      } else {
        initialize(accounts[0]);
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
  }, []);

  const resetState = useCallback(() => {
    setSelectedAddress(undefined);
    setTokenData(undefined);
    setBalance(undefined);
    setTxBeingSent(undefined);
    setTransactionError(undefined);
    setNetworkError(undefined);
    setContract(undefined);
  }, []);

  const dismissTransactionError = () => setTransactionError(undefined);
  const dismissNetworkError = () => setNetworkError(undefined);

  const transferTokens = async(to, amount) => {
    // Sending a transaction is a complex operation:
    //   - The user can reject it
    //   - It can fail before reaching the ethereum network (i.e. if the user
    //     doesn't have ETH for paying for the tx's gas)
    //   - It has to be mined, so it isn't immediately confirmed.
    //     Note that some testing networks, like Hardhat Network, do mine
    //     transactions immediately, but your dapp should be prepared for
    //     other networks.
    //   - It can fail once mined.
    //
    // This method handles all of those things, so keep reading to learn how to
    // do it.

    try {
      // If a transaction fails, we save that error in the component's state.
      // We only save one such error, so before sending a second transaction, we
      // clear it.
      dismissTransactionError();

      // We send the transaction, and save its hash in the Dapp's state. This
      // way we can indicate that we are waiting for it to be mined.
      const tx = await contract.transfer(to, amount);
      setTxBeingSent(txBeingSent);

      // We use .wait() to wait for the transaction to be mined. This method
      // returns the transaction's receipt.
      const receipt = await tx.wait();

      // The receipt, contains a status flag, which is 0 to indicate an error.
      if (receipt.status === 0) {
        // We can't know the exact error that made the transaction fail when it
        // was mined, so we throw this generic one.
        throw new Error("Transaction failed");
      }

      // If we got here, the transaction was successful, so you may want to
      // update your state. Here, we update the user's balance.
      await updateBalance();
    } catch (error) {
      // We check the error code to see if this error was produced because the
      // user rejected a tx. If that's the case, we do nothing.
      if (error.code === ERROR_CODE_TX_REJECTED_BY_USER) {
        return;
      }

      // Other errors are logged and stored in the Dapp's state. This is used to
      // show them to the user, and for debugging.
      console.error(error);
      setTransactionError(error);
    } finally {
      // If we leave the try/catch, we aren't sending a tx anymore, so we clear
      // this part of the state.
      txBeingSent(undefined);
    }
  }

  const updateBalance = async () => {
    const balanceSealed = await this._token.balanceOfEncrypted(this.state.selectedAddress, this._permit);
    const balance = this._fhenixClient.unseal(contractAddress.address, balanceSealed);
    this.setState({ balance });
  }

  const getRpcErrorMessage = (error) => {
    if (error.data) {
      return error.data.message;
    }

    return error.message;
  }

  const connectWallet = async () => {
    try {
      const [selectedAddress] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      await checkNetwork();
      setSelectedAddress(selectedAddress)
      await initialize(selectedAddress);
    } catch (error) {
      console.error("Error on connecting the wallet: ", error);
    }
  };

  useEffect(() => {
    const updateTokenData = async () => {
      if (contract) {
        const name = await contract.name();
        const symbol = await contract.symbol();
        setTokenData({ name, symbol });
      }
    }
    updateTokenData();
  }, [contract]);

  useEffect(() => {
    const updateBalance = async () => {
      if (contract && selectedAddress && fhenixClient && permit) {
        try {
          console.log(`getting balance: ${selectedAddress}, permit = ${JSON.stringify(permit)}`);
          const balanceSealed = await contract.balanceOfEncrypted(selectedAddress, permit);
          console.log(`balance sealed: ${balanceSealed}`);
          fhenixClient.storePermit(permit);
          const balance = fhenixClient.unseal(contractAddress.address, balanceSealed);
          console.log(`balance: ${balance}`)
          setBalance(balance);
        } catch (e) {
          console.warn(e)
          // permit not set yet probably
        }
      }
    }

    updateBalance();
  }, [contract, selectedAddress, permit, fhenixClient]);

  const initialize = async (userAddress) => {
    setSelectedAddress(userAddress);
    const provider = new BrowserProvider(window.ethereum);

    const signer = await provider.getSigner();
    const contract = new ethers.Contract(contractAddress.address, TokenArtifact.abi, signer);
    setContract(contract);
    const fhenixClient = new FhenixClient({provider});
    setFhenixClient(fhenixClient);
    console.log(`loading permit for ${contractAddress.address}`);
    let permit = await getPermit(contractAddress.address, provider);
    if (!permit) {
      permit = await fhenixClient.generatePermit(
        contractAddress.address,
        undefined,
        signer
      )
    }
    setPermit(permit)
  };

  async function checkNetwork() {
    const chainIdFromNetwork = parseInt(window.ethereum.chainId, 10);
    const chainIdHex = `0x${HARDHAT_NETWORK_ID.toString(16)}`
    if (chainIdFromNetwork !== HARDHAT_NETWORK_ID) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: chainIdHex }],
        });
      } catch (switchError) {
        console.error("Network switch error: ", switchError);
        setNetworkError(switchError.toString());

        // Handling "User rejected the request."
        if (switchError.code === ERROR_CODE_TX_REJECTED_BY_USER) {
          return;
        }
      }
    }
  }

  if (window.ethereum === undefined) {
    return <NoWalletDetected />;
  }
  if (!selectedAddress) {
    return (
      <ConnectWallet
        connectWallet={() => connectWallet()}
        networkError={networkError}
        dismiss={() => dismissNetworkError()}
      />
    );
  }

  if (!tokenData || balance === undefined) {
    return <Loading />;
  }
  // The UI will be similar as in the class component version but leveraging the useState values

  return (
    <div className="container p-4">
      <div className="row">
        <div className="col-12">
          <h1>
            {tokenData.name} ({tokenData.symbol})
          </h1>
          <p>
            Welcome <b>{selectedAddress}</b>, you have{" "}
            <b>
              {balance.toString()} {tokenData.symbol}
            </b>
            .
          </p>
        </div>
      </div>

      <hr />

      <div className="row">
        <div className="col-12">
          {/*
              Sending a transaction isn't an immediate action. You have to wait
              for it to be mined.
              If we are waiting for one, we show a message here.
            */}
          {txBeingSent && (
            <WaitingForTransactionMessage txHash={txBeingSent} />
          )}

          {/*
              Sending a transaction can fail in multiple ways.
              If that happened, we show a message here.
            */}
          {transactionError && (
            <TransactionErrorMessage
              message={getRpcErrorMessage(transactionError)}
              dismiss={dismissTransactionError}
            />
          )}
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          {/*
              If the user has no tokens, we don't show the Transfer form
            */}
          {balance === 0 && (
            <NoTokensMessage selectedAddress={selectedAddress} />
          )}

          {/*
              This component displays a form that the user can use to send a
              transaction and transfer some tokens.
              The component doesn't have logic, it just calls the transferTokens
              callback.
            */}
          {balance > 0 && (
            <Transfer
              transferTokens={(to, amount) =>
                transferTokens(to, amount)
              }
              tokenSymbol={tokenData.symbol}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// render();
// {
//   // Ethereum wallets inject the window.ethereum object. If it hasn't been
//   // injected, we instruct the user to install a wallet.
//   if (window.ethereum === undefined) {
//     return <NoWalletDetected />;
//   }
//
//   // The next thing we need to do, is to ask the user to connect their wallet.
//   // When the wallet gets connected, we are going to save the users's address
//   // in the component's state. So, if it hasn't been saved yet, we have
//   // to show the ConnectWallet component.
//   //
//   // Note that we pass it a callback that is going to be called when the user
//   // clicks a button. This callback just calls the _connectWallet method.
//   if (!this.state.selectedAddress) {
//     return (
//       <ConnectWallet
//         connectWallet={() => this._connectWallet()}
//         networkError={this.state.networkError}
//         dismiss={() => this._dismissNetworkError()}
//       />
//     );
//   }
//
//   // If the token data or the user's balance hasn't loaded yet, we show
//   // a loading component.
//   if (!this.state.tokenData || this.state.balance === undefined) {
//     return <Loading />;
//   }
//
//   // If everything is loaded, we render the application.
//   return (
//
//   );
// }
//
// componentWillUnmount();
// {
//   // We poll the user's balance, so we have to stop doing that when Dapp
//   // gets unmounted
//   this._stopPollingData();
// }
//
// async;
// _connectWallet();
// {
//   // This method is run when the user clicks the Connect. It connects the
//   // dapp to the user's wallet, and initializes it.
//
//   // To connect to the user's wallet, we have to run this method.
//   // It returns a promise that will resolve to the user's address.
//   const [selectedAddress] = await window.ethereum.request({ method: "eth_requestAccounts" });
//
//   // Once we have the address, we can initialize the application.
//
//   // First we check the network
//   this._checkNetwork();
//
//   await this._initialize(selectedAddress);
//
//   // We reinitialize it whenever the user changes their account.
//   window.ethereum.on("accountsChanged", ([newAddress]) => {
//     this._stopPollingData();
//     // `accountsChanged` event can be triggered with an undefined newAddress.
//     // This happens when the user removes the Dapp from the "Connected
//       // list of sites allowed access to your addresses" (Metamask > Settings > Connections)
//       // To avoid errors, we reset the dapp state
//       if (newAddress === undefined) {
//         return this._resetState();
//       }
//
//       this._initialize(newAddress);
//     });
//   }
//
//   async _initialize(userAddress) {
//     // This method initializes the dapp
//
//     // We first store the user's address in the component's state
//     this.setState({
//       selectedAddress: userAddress,
//     });
//
//     // Then, we initialize ethers, fetch the token's data, and start polling
//     // for the user's balance.
//
//     // Fetching the token data and the user's balance are specific to this
//     // sample project, but you can reuse the same initialization pattern.
//     this._initializeEthers().then(() =>
//       {
//         this._getTokenData();
//         this._startPollingData();
//       }
//     );
//   }
//
//   async _initializeEthers() {
//
//     // We first initialize ethers by creating a provider using window.ethereum
//     this._provider = new BrowserProvider(window.ethereum);
//
//     this._fhenixClient = new FhenixClient({provider: this._provider});
//
//     let signer = await this._provider.getSigner();
//
//     // Then, we initialize the contract using that provider and the token's
//     // artifact. You can do this same thing with your contracts.
//     this._token = await new ethers.Contract(
//       contractAddress.address,
//       TokenArtifact.abi,
//       signer
//     );
//
//     this._permit = await this._fhenixClient.generatePermit(
//       contractAddress.address,
//       undefined,
//       signer
//     )
//   }
//
//   // The next two methods are needed to start and stop polling data. While
//   // the data being polled here is specific to this example, you can use this
//   // pattern to read any data from your contracts.
//   //
//   // Note that if you don't need it to update in near real time, you probably
//   // don't need to poll it. If that's the case, you can just fetch it when you
//   // initialize the app, as we do with the token data.
//   _startPollingData() {
//     this._pollDataInterval = setInterval(() => this._updateBalance(), 3000);
//
//     // We run it once immediately so we don't have to wait for it
//     this._updateBalance();
//   }
//
//   _stopPollingData() {
//     clearInterval(this._pollDataInterval);
//     this._pollDataInterval = undefined;
//   }
//
//   // The next two methods just read from the contract and store the results
//   // in the component state.
//   async _getTokenData() {
//     const name = await this._token.name();
//     const symbol = await this._token.symbol();
//
//     this.setState({ tokenData: { name, symbol } });
//   }
//
//   async _updateBalance() {
//     const balanceSealed = await this._token.balanceOfEncrypted(this.state.selectedAddress, this._permit);
//     const balance = this._fhenixClient.unseal(contractAddress.address, balanceSealed);
//     this.setState({ balance });
//   }
//
//   // This method sends an ethereum transaction to transfer tokens.
//   // While this action is specific to this application, it illustrates how to
//   // send a transaction.
//   async _transferTokens(to, amount) {
//     // Sending a transaction is a complex operation:
//     //   - The user can reject it
//     //   - It can fail before reaching the ethereum network (i.e. if the user
//     //     doesn't have ETH for paying for the tx's gas)
//     //   - It has to be mined, so it isn't immediately confirmed.
//     //     Note that some testing networks, like Hardhat Network, do mine
//     //     transactions immediately, but your dapp should be prepared for
//     //     other networks.
//     //   - It can fail once mined.
//     //
//     // This method handles all of those things, so keep reading to learn how to
//     // do it.
//
//     try {
//       // If a transaction fails, we save that error in the component's state.
//       // We only save one such error, so before sending a second transaction, we
//       // clear it.
//       this._dismissTransactionError();
//
//       // We send the transaction, and save its hash in the Dapp's state. This
//       // way we can indicate that we are waiting for it to be mined.
//       const tx = await this._token.transfer(to, amount);
//       this.setState({ txBeingSent: tx.hash });
//
//       // We use .wait() to wait for the transaction to be mined. This method
//       // returns the transaction's receipt.
//       const receipt = await tx.wait();
//
//       // The receipt, contains a status flag, which is 0 to indicate an error.
//       if (receipt.status === 0) {
//         // We can't know the exact error that made the transaction fail when it
//         // was mined, so we throw this generic one.
//         throw new Error("Transaction failed");
//       }
//
//       // If we got here, the transaction was successful, so you may want to
//       // update your state. Here, we update the user's balance.
//       await this._updateBalance();
//     } catch (error) {
//       // We check the error code to see if this error was produced because the
//       // user rejected a tx. If that's the case, we do nothing.
//       if (error.code === ERROR_CODE_TX_REJECTED_BY_USER) {
//         return;
//       }
//
//       // Other errors are logged and stored in the Dapp's state. This is used to
//       // show them to the user, and for debugging.
//       console.error(error);
//       this.setState({ transactionError: error });
//     } finally {
//       // If we leave the try/catch, we aren't sending a tx anymore, so we clear
//       // this part of the state.
//       this.setState({ txBeingSent: undefined });
//     }
//   }
//
//   // This method just clears part of the state.
//   _dismissTransactionError() {
//     this.setState({ transactionError: undefined });
//   }
//
//   // This method just clears part of the state.
//   _dismissNetworkError() {
//     this.setState({ networkError: undefined });
//   }
//
//   // This is an utility method that turns an RPC error into a human readable
//   // message.
//   _getRpcErrorMessage(error) {
//     if (error.data) {
//       return error.data.message;
//     }
//
//     return error.message;
//   }
//
//   // This method resets the state
//   _resetState() {
//     this.setState(this.initialState);
//   }
//
//   async _switchChain() {
//     const chainIdHex = `0x${HARDHAT_NETWORK_ID.toString(16)}`
//     await window.ethereum.request({
//       method: "wallet_switchEthereumChain",
//       params: [{ chainId: chainIdHex }],
//     });
//     await this._initialize(this.state.selectedAddress);
//   }
//
//   // This method checks if the selected network is Localhost:8545
//   _checkNetwork() {
//     try {
//       console.log(`connected to chainId: ${window.ethereum.networkVersion}`)
//       if (window.ethereum.networkVersion !== HARDHAT_NETWORK_ID) {
//         this._switchChain();
//       }
//     } catch (e) {
//       console.error(e);
//     }
//   }
// }

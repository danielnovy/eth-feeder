var Web3    = require('web3');
var Promise = require('bluebird');
var quote   = require('./quote.js');
var Hooked  = require('hooked-web3-provider');
var Tx      = require('ethereumjs-tx');
var Exec    = require('child_process').exec;
var Lw      = require('eth-lightwallet');

var QUOTE_CMD = 'curl -s https://poloniex.com/public?command=returnTicker |jq \'.["USDT_ETH"]\'|jq \'.["last"]\'|cut -d\\" -f2';
var WALLET_SEED = '';
var WALLET_PASSWORD = '';
var ASSET_NAME = 'ETHUSD_D_REGIS';

var args = process.argv.slice(2);
if (args.length == 0) {
    console.log('\n\tSyntax: feed.js <setup|feed>\n');
    return;
}

var web3    = new Web3();
var provider = new Hooked({
    host: 'http://regis.nu:8540',
    transaction_signer: {
        hasAddress: function(address, callback) {
            callback(null, true);
        },
        signTransaction: function(tx_params, callback) {
            tx_params.gasLimit = tx_params.gas;
            tx_params.gasPrice = gasPrice;
            var tx = new Tx(tx_params);
            var pk = keystore.exportPrivateKey(tx_params.from.substring(2), pwDerivedKey);
            tx.sign(new Buffer(pk, 'hex'));
            var signed = tx.serialize().toString('hex');
            callback(null, signed);
        }
    }
});
web3.setProvider(provider);


var keystore;
var myAddress;
var pwDerivedKey;
var gasPrice    = '0x' + web3.eth.gasPrice.toString(16);
var abi         = JSON.parse(quote.abi);
var deriveKey   = Promise.promisify(Lw.keystore.deriveKeyFromPassword);
var getBalance  = Promise.promisify(web3.eth.getBalance);
var contract    = web3.eth.contract(abi).at(quote.address);
var quotes      = Promise.promisify(contract.quotes);
var exec        = Promise.promisify(Exec);

deriveKey(WALLET_PASSWORD).then(function(derivedKey) {
    pwDerivedKey = derivedKey;
    keystore = new Lw.keystore(WALLET_SEED, derivedKey);
    keystore.generateNewAddress(derivedKey, 1);
    myAddress = keystore.getAddresses()[0];
    return getBalance(myAddress);
}).then(function(balance) {
    if (args[0] == 'feed') {
        feed();
    } else if (args[0] == 'setup') {
        setup();
    } else {
        console.log('Unknown command "' + args[0] + '". Expected "setup" or "feed".');
    }
});

function feed() {
    var storedQuote = quotes.call(ASSET_NAME);
    exec(QUOTE_CMD)
    .then(function(value) {
        var currentQuote = Math.round(value * 100);
        var rel = currentQuote / storedQuote;
        if (rel > 1.1 || rel < 0.9) {
            // update quote
            var updateQuote = Promise.promisify(contract.updateQuote);
            return updateQuote(ASSET_NAME, currentQuote, {from:myAddress, gas:100000})
        } else {
            throw new Error('Quote does not need to be updated (stored: ' + storedQuote + ', current: ' + currentQuote + ').');
        }
    }).then(function(tx) {
        return getTransactionReceipt(tx);
    }).then(function(receipt) {
        console.log('Quote updated (stored: ' + storedQuote + ', current: ' + currentQuote + '). Gas used: ' + receipt.gasUsed);
    }).catch(function(error) {
        console.log('' + error);
    });
}

function setup() {
    var setFeederFor = Promise.promisify(contract.setFeederFor);
    setFeederFor(ASSET_NAME, {from:myAddress, gas:100000})
    .then(function(tx) {
        return getTransactionReceipt(tx);
    })
    .then(function(receipt) {
        console.log('Setup complete. Gas used: ' + receipt.gasUsed);
    });
}

function getTransactionReceipt(hash) {
    var getReceipt = Promise.promisify(web3.eth.getTransactionReceipt);
    return new Promise(function(resolve, reject) {
        var interval = setInterval(function() {
            getReceipt(hash)
            .then(function(receipt) {
                if (receipt != null) {
                    clearInterval(interval);
                    resolve(receipt);
                } else {
                    //console.log('Waiting for the contract to be mined...');
                }
            })
            .catch(function(err) {
                reject(err);
            });
        }, 1000);
    });
}

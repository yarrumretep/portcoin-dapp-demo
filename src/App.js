import React, { Component } from 'react';

import contract from 'truffle-contract';
import PortCoinSpec from './PortCoin.json';

const PortCoin = contract(PortCoinSpec);

const promise = (func) => new Promise((resolve, reject) => {
  try {
    func((err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    })
  } catch (e) {
    reject(e)
  }
})

class App extends Component {

  filters=[];
  state = {
    logs:{}
  };

  componentWillMount() {
    var web3 = this.props.web3;

    PortCoin.setProvider(web3.currentProvider);

    this.timer = setInterval(() => {
      promise(cb=>web3.eth.getAccounts(cb))
      .then(accounts => {
        if (this.state.account !== accounts[0]) {
          return this.setState({
            account: accounts[0]
          }, ()=>this.update())
        }
      })
      .catch(error => {
        //TODO: error handling
        console.error(error);
      })
    }, 500)
  }

  update() {
    if(this.state.account) {
      promise(cb => this.props.web3.eth.getBalance(this.state.account, cb))
      .then(balance => this.setState({
        balance: this.props.web3.fromWei(balance, 'ether').toString()
      }))
      .then(()=>PortCoin.deployed())
      .then(portcoin =>  {

        const getPortBalance = () => portcoin.balanceOf(this.state.account)
        .then(portbalance => this.setState({
          portbalance: portbalance.toString()
        }));

        var options = {
          fromBlock:0,
          toBlock:'latest'
        }
        this.setState({
          logs:{}
        });

        this.filters.forEach(filter=>filter.stopWatching());

        var filters = [
          portcoin.Transfer({
            from: this.state.account
          }, options),
          portcoin.Transfer({
            to: this.state.account
          }, options)
        ];

        filters.forEach(filter => filter.watch((err, log) => {
          if(err) {
            console.log(err);
          } else {
            this.setState({
              logs: {
                ...this.state.logs,
                [log.transactionHash]: log
              }
            });
            getPortBalance();
          }
        }));

        this.filters = filters;
        getPortBalance();
      })
    }
  }

  transfer() {
    var to = window.prompt("Enter destination address");
    var amount = window.prompt("Enter quantity");
    if(window.confirm("Send " + amount + " to " + to + "?")) {
      PortCoin.deployed()
      .then(portcoin => {
        portcoin.transfer(to, amount, {from: this.state.account});
      })
    }
  }

  render() {
    return (
      <div>
        <div>Hello world!</div>
        <div>Web3 Version:{this.props.web3.version.api}</div>
        <div>Account:{this.state.account}</div>
        <div>Balance:{this.state.balance}</div>
        <div>PORT:{this.state.portbalance}</div>
        <a href="#" onClick={()=>this.transfer()}>Transfer</a>
        <div>PORT Transactions:</div>
        <table border={1}>
          <thead>
            <tr>
              <th>Block</th>
              <th>Transaction</th>
              <th>From</th>
              <th>To</th>
              <th>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(this.state.logs).sort((x, y) => y.blockNumber - x.blockNumber).map(log => (
              <tr key={log.transactionHash}>
                <td>{log.blockNumber}</td>
                <td>{log.transactionHash}</td>
                <td>{log.args.from}</td>
                <td>{log.args.to}</td>
                <td>{+log.args.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}

export default App;

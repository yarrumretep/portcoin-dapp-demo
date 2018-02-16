import React, { Component } from 'react';
import bn from 'bignumber.js';
import {
  Navbar,
  Panel,
  Table,
  Button,
  Col,
  Row,
  Modal
} from 'react-bootstrap';
import QrReader from 'react-qr-reader';

import { QRCode } from 'react-qr-svg';

import Blockie from './Blockie';

import contract from 'truffle-contract';
import PortCoinSpec from 'port/build/contracts/PortCoin.json';
import PortMayorSpec from 'port/build/contracts/PortMayor.json';
import { createEvent, decode, getEventAddress } from 'port/lib/event.js';

const PortCoin = contract(PortCoinSpec);
const PortMayor = contract(PortMayorSpec);

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

  filters = [];
  state = {
    logs: {}
  };

  componentWillMount() {
    var web3 = this.props.web3;

    PortCoin.setProvider(web3.currentProvider);
    PortMayor.setProvider(web3.currentProvider);

    this.timer = setInterval(() => {
      promise(cb => web3.eth.getAccounts(cb))
        .then(accounts => {
          if (this.state.account !== accounts[0]) {
            return this.setState({
              account: accounts[0]
            }, () => this.update())
          }
        })
        .catch(error => {
          //TODO: error handling
          console.error(error);
        })
    }, 500)
  }

  update() {
    if (this.state.account) {
      Promise.resolve()
        .then(() => PortCoin.deployed())
        .then(portcoin => {
          const getPortBalance = () => portcoin.balanceOf(this.state.account)
            .then(portbalance => this.setState({
              portbalance: portbalance.toString()
            }));

          var options = {
            fromBlock: 0,
            toBlock: 'latest'
          }
          this.setState({
            logs: {}
          });

          this.filters.forEach(filter => filter.stopWatching());

          var filters = [
            portcoin.Transfer({
              from: this.state.account
            }, options),
            portcoin.Transfer({
              to: this.state.account
            }, options)
          ];

          filters.forEach(filter => filter.watch((err, log) => {
            if (err) {
              console.log(err);
            } else {
              this.setState({
                logs: {
                  ...this.state.logs,
                  [log.transactionHash]: log
                }
              });
              getPortBalance()
            }
          }));

          this.filters = filters;
          getPortBalance();
        })
        .then(() => PortMayor.deployed())
        .then(mayor => mayor.owner())
        .then(owner => this.setState({
          owner: owner
        }))
    }
  }

  transfer() {
    var to = window.prompt("Enter destination address");
    var amount = window.prompt("Enter quantity");
    if (window.confirm("Send " + amount + " to " + to + "?")) {
      PortCoin.deployed()
        .then(portcoin => {
          return this.waitFor(() => portcoin.transfer(to, amount, { from: this.state.account }))
            .then(result => window.alert('tx mined!'));
        })
    }
  }

  issue() {
    var to = window.prompt("Enter destination address");
    var amount = window.prompt("Enter quantity");
    if (window.confirm("Issue " + amount + " to " + to + "?")) {
      PortMayor.deployed()
        .then(mayor => {
          mayor.issue(to, amount, { from: this.state.account })
            .then(result => window.alert('tx mined!'));
        })
    }
  }

  startClaim() {
    this.setState({
      claiming: true,
      ticket: null,
      address: null,
      number: null,
      signature: null,
      status: null
    });
  }

  claim() {
    if (this.state.signature) {
      var vrs = decode(this.state.number, this.state.signature);
      this.setState({ claiming: false });
      PortMayor.deployed()
        .then(mayor => this.waitFor(() => mayor.attend(vrs.n, vrs.r, vrs.s, vrs.v, { from: this.state.account })))
        .then(result => window.alert('tx mined!'));
    }
  }

  create() {
    var count = window.prompt("How many tickets?");
    if (count && Number(count) > 0) {
      this.setState({
        event: createEvent(Number(count)),
        eventRegistered: false
      })
    }
  }

  register() {
    if (this.state.event) {
      this.setState({
        eventRegistering: true
      })
      PortMayor.deployed()
        .then(mayor => mayor.createEvent(this.state.event.event, { from: this.state.account }))
        .then(result => this.setState({ eventRegistered: true }))
        .catch(console.error)
        .then(() => this.setState({ eventRegistering: false }))
    }
  }

  setTicket(ticket) {
    if (ticket) {
      var [number, signature] = ticket.split(':');
      var address = getEventAddress(number, signature);
      this.setState({
        ticket,
        address,
        number,
        signature,
        status: 'checking...'
      });
      PortMayor.deployed()
        .then(mayor => mayor.isValidTicket(address, number))
        .then(valid => this.setState({ status: valid ? 'valid' : 'invalid' }))
    }
  }

  waitFor(fn) {
    this.setState({ waiting: true });
    return fn()
      .then(result => {
        this.setState({ waiting: false });
        return result;
      })
      .catch(e => {
        this.setState({ waiting: false });
        throw e;
      })
  }

  render() {
    const short = (val) => val.slice(0, 8) + "..." + val.slice(-6)

    if (this.state.event) {
      return (
        <div>
        {!this.state.event.eventRegistered && <Button disabled={this.state.eventRegistering} onClick={()=>this.register()}>Register this event</Button>}
        {this.state.event.tickets.map((ticket, i) => (
          <Row key={ticket.n} style={({padding:'20px', margin:'20px', border:'5px solid black', breakAfter: (i+1) % 3 === 0 ? 'page' : 'auto'})}>
            <Col xs={4}>
              <QRCode style={({width:200, height:200})} value={ticket.n + ":" + ticket.sig}/>
            </Col>
            <Col xs={8}>
              <h2 style={({textAlign:'center'})}><b>This ticket is good for 1</b></h2>
              <h1 style={({textAlign:'center'})}><b>PortCoin</b></h1>
              <h2 style={({textAlign:'center'})}>Claim your coin at</h2>
              <h2 style={({textAlign:'center'})}>https://portcoin.cool</h2>
            </Col>
          </Row>
        ))}
        </div>
      );
    } else {
      return (
        <div className="container">
        <Navbar style={({marginTop: '20px'})}>
          <Navbar.Header>
            <Navbar.Brand>
              Port Coin
            </Navbar.Brand>
          </Navbar.Header>
        </Navbar>
        <Panel>
          <Panel.Heading>
            <div><Blockie address={this.state.account}/> Address: {this.state.account}</div>
          </Panel.Heading>
          <Panel.Body>
            <h1>PORT Balance: {this.state.portbalance}</h1>
            <Button bsStyle="success" onClick={()=>this.startClaim()}>Claim</Button>
            &nbsp;&nbsp;
            <Button bsStyle="warning" onClick={()=>this.transfer()}>Transfer</Button>
            {this.state.owner && this.state.owner === this.state.account && (
              <span>
                &nbsp;&nbsp;
                <Button bsStyle="primary" onClick={()=>this.issue()}>Issue</Button>
                &nbsp;&nbsp;
                <Button bsStyle="primary" onClick={()=>this.create()}>Create Event</Button>
              </span>
            )}
            <div>PORT Transactions:</div>
            <Table >
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(this.state.logs).sort((x, y) => y.blockNumber - x.blockNumber).map(log => (
                  <tr key={log.transactionHash}>
                    <td><a target="etherscan" href={"https://etherscan.io/tx/" + log.transactionHash}>{short(log.transactionHash)}</a></td>
                    <td>{new bn(log.args.from).eq(0) ? 'PORT Mayor' : short(log.args.from)}</td>
                    <td>{short(log.args.to)}</td>
                    <td>{+log.args.value}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel.Body>
        </Panel>
        <Modal show={this.state.claiming} onHide={()=>this.setState({claiming:false})}>
        <Modal.Header closeButton>Claim PortCoin Ticket</Modal.Header>
        <Modal.Body>
        {
          this.state.ticket
          ?
          <div>
            <div>Event: {this.state.address}</div>
            <div>Status: {this.state.status}</div>
            <Button bsStyle="warning" onClick={()=>this.setState({claiming:false})}>Cancel</Button>
            &nbsp;
            <Button bsStyle="success" onClick={()=>this.claim()} disabled={this.state.status !== 'valid'}>Claim!</Button>

          </div>
          :
          <QrReader onScan={ticket=>this.setTicket(ticket)}/>
        }
        </Modal.Body>
        </Modal>
        <Modal show={this.state.waiting}>
        <Modal.Body>
          Waiting for transaction to mine...
        </Modal.Body>
        </Modal>
      </div>
      );
    }
  }
}

export default App;
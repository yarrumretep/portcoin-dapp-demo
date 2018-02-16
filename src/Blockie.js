import React, { Component } from 'react';

import { toDataUrl } from 'ethereum-blockies';

export default class Blockie extends Component {

  state = {};

  componentWillMount() {
    this.update(this.props);
  }

  componentWillReceiveProps(newProps) {
    this.update(newProps);
  }

  update(props) {
    if (props.address !== this.current) {
      this.setState({
        blockie: toDataUrl(props.address)
      })
      this.current = props.address;
    }
  }

  render() {
    return <img width={32} height={32} src={this.state.blockie} alt={this.props.address}/>
  }
}
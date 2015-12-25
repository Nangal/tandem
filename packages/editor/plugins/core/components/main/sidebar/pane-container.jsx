import './pane-container.scss';

import React from 'react';

class PaneContainerComponent extends React.Component {
  render() {
    return <div className='m-pane-container'>
      <div className='m-pane-container--header'>
        { this.props.plugin.label }
      </div>
      <div className='m-pane-container--content'>
        { this.props.plugin.factory.create(this.props) }
      </div>
    </div>
  }
}

export default PaneContainerComponent;
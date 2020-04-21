import React from 'react';
import ReactDOM from 'react-dom';

import { Row, Col } from 'reactstrap';

const ContactPage = () => {
  return (
    <div>
      <br />
      <Row>
        <Col md={2} />
        <Col md={8}>
          <div className="card" style={{ padding: '10px' }}>
            <h4>Contact</h4>
            <p>
              Feel free to contact us if you have any issues or concerns. Comments, ideas, and suggestions are always
              welcome. Here are the easiest ways to get in touch with us:
            </p>
            <dl className="row">
              <dt className="col-md-4">Official Twitter</dt>
              <dd className="col-md-8">
                <p>
                  <a href="https://twitter.com/CubeCobra1">@CubeCobra1</a>
                </p>
              </dd>
              <dt className="col-md-4">Email</dt>
              <dd className="col-md-8">
                <p>
                  <a href="mailto:support@cubecobra.com">support@cubecobra.com</a>
                </p>
              </dd>
              <dt className="col-md-4">Discord</dt>
              <dd className="col-md-8">
                <p>
                  <a href="https://discord.gg/Hn39bCU">https://discord.gg/Hn39bCU</a>
                </p>
              </dd>
            </dl>
          </div>
        </Col>
        <Col md={2} />
      </Row>
    </div>
  );
};

const wrapper = document.getElementById('react-root');
const element = <ContactPage {...window.reactProps} />;
if (wrapper) {
  if (wrapper.children.length === 0) {
    ReactDOM.render(element, wrapper);
  } else {
    ReactDOM.hydrate(element, wrapper);
  }
}

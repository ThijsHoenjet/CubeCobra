import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Col,
  FormGroup,
  Input,
  Label,
  Nav,
  NavItem,
  NavLink,
  Row,
  TabContent,
  TabPane,
  Card,
  CardBody,
} from 'reactstrap';

import Query from 'utils/Query';

import AutocompleteInput from 'components/AutocompleteInput';
import CSRFForm from 'components/CSRFForm';
import Advertisement from 'components/Advertisement';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const UserAccountPage = ({ user, defaultNav, loginCallback }) => {
  const [nav, setNav] = useState(defaultNav);
  const [imageValue, setImageValue] = useState('');
  const [imageDict, setImageDict] = useState({});

  useEffect(() => {
    fetch('/cube/api/imagedict')
      .then((response) => response.json())
      .then((json) => setImageDict(json.dict));
  }, []);

  const handleClickNav = useCallback((event) => {
    event.preventDefault();
    setNav(event.target.getAttribute('data-nav'));
  }, []);

  const handleChangeImage = useCallback((event) => {
    setImageValue(event.target.value);
  }, []);

  const handleSubmitImage = useCallback((event) => {
    event.preventDefault();
  }, []);

  const result = imageDict[imageValue.toLowerCase()];
  let image;
  if (result) {
    image = {
      name: imageValue.replace(/ \[[^\]]*\]$/, ''),
      ...result,
    };
  } else {
    image = {
      name: user.image_name,
      uri: user.image,
      artist: user.artist,
    };
  }

  useEffect(() => {
    if (nav === 'profile') {
      Query.del('nav');
    } else {
      Query.set('nav', nav);
    }
  }, [nav]);

  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <Advertisement />
      <h2 className="mt-3">My Account </h2>
      <DynamicFlash />
      <Row className="mb-3">
        <Col xs={3}>
          <Nav vertical pills>
            <NavItem>
              <NavLink href="#" active={nav === 'profile'} data-nav="profile" onClick={handleClickNav}>
                Profile
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="#" active={nav === 'password'} data-nav="password" onClick={handleClickNav}>
                Change Password
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="#" active={nav === 'email'} data-nav="email" onClick={handleClickNav}>
                Update Email
              </NavLink>
            </NavItem>
          </Nav>
        </Col>
        <Col xs={9}>
          <TabContent activeTab={nav}>
            <TabPane tabId="profile">
              <Card>
                <CardBody>
                  <CSRFForm method="POST" action="/user/updateuserinfo">
                    <div className="form-group">
                      <dl className="row">
                        <dt className="col-sm-3">Username</dt>
                        <dd className="col-sm-9">
                          <Input name="username" defaultValue={user.username} />
                        </dd>
                        <dt className="col-sm-3">Email</dt>
                        <dd className="col-sm-9">{user.email}</dd>
                        <dt className="col-sm-3">About</dt>
                        <dd className="col-sm-9">
                          <Input
                            type="textarea"
                            maxLength="2500"
                            placeholder="Describe yourself here... (max length 2500)"
                            name="body"
                            defaultValue={user.about}
                          />
                        </dd>
                        <dt className="col-sm-3">Profile Pic</dt>
                        <dd className="col-sm-9">
                          <Row>
                            <Col xs={6}>
                              <div className="position-relative">
                                <img width="100%" src={image.uri} alt={image.name} />
                                <em className="cube-preview-artist">Art by {image.artist}</em>
                              </div>
                            </Col>
                            <Col xs={6}>
                              <AutocompleteInput
                                treeUrl="/cube/api/fullnames"
                                treePath="cardnames"
                                type="text"
                                className="mr-2"
                                name="remove"
                                value={imageValue}
                                onChange={handleChangeImage}
                                onSubmit={handleSubmitImage}
                                placeholder="Cardname for Image"
                                autoComplete="off"
                                data-lpignore
                              />
                              {result && <Input type="hidden" name="image" value={imageValue.toLowerCase()} />}
                            </Col>
                          </Row>
                        </dd>
                      </dl>
                      <Row noGutters>
                        <Button className="ml-auto" block outline color="success" type="submit">
                          Update
                        </Button>
                      </Row>
                    </div>
                  </CSRFForm>
                </CardBody>
              </Card>
            </TabPane>
            <TabPane tabId="password">
              <Card>
                <CardBody>
                  <CSRFForm method="POST" action="/user/resetpassword">
                    <FormGroup row>
                      <Label for="password" className="col-sm-4 col-form-Label">
                        Old password:
                      </Label>
                      <Input className="col-sm-8" id="currentPassword" name="password" type="password" />
                    </FormGroup>
                    <FormGroup row>
                      <Label for="newPassword" className="col-sm-4 col-form-Label">
                        New Password:
                      </Label>
                      <Input className="col-sm-8" id="newPassword" name="password2" type="password" />
                    </FormGroup>
                    <FormGroup row>
                      <Label for="confirmPassword" className="col-sm-4 col-form-Label">
                        Confirm New Password:
                      </Label>
                      <Input className="col-sm-8" id="confirmPassword" name="password3" type="password" />
                    </FormGroup>
                    <Button outline block color="success" type="submit">
                      Change Password
                    </Button>
                  </CSRFForm>
                </CardBody>
              </Card>
            </TabPane>
            <TabPane tabId="email">
              <Card>
                <CardBody>
                  <CSRFForm method="POST" action="/user/updateemail">
                    <FormGroup row>
                      <Label for="email" className="col-sm-4 col-form-Label">
                        New Email:
                      </Label>
                      <Input className="col-sm-8" id="email" name="email" type="email" defaultValue={user.email} />
                    </FormGroup>
                    <FormGroup row>
                      <Label for="emailPassword" className="col-sm-4 col-form-Label">
                        Password:
                      </Label>
                      <Input className="col-sm-8" id="emailPassword" name="password" type="password" />
                    </FormGroup>
                    <Button block outline color="success" type="submit">
                      Update
                    </Button>
                  </CSRFForm>
                </CardBody>
              </Card>
            </TabPane>
          </TabContent>
        </Col>
      </Row>
    </MainLayout>
  );
};

UserAccountPage.propTypes = {
  user: PropTypes.shape({
    email: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    about: PropTypes.string.isRequired,
    image_name: PropTypes.string,
    image: PropTypes.string,
    artist: PropTypes.string,
    users_following: PropTypes.arrayOf(PropTypes.shape({}).isRequired),
  }).isRequired,
  defaultNav: PropTypes.string.isRequired,
  loginCallback: PropTypes.string,
};

export default RenderToRoot(UserAccountPage);

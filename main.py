#!/usr/bin/env python
# -*- coding: utf-8 -*-
#
# Copyright 2007 Google Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
import webapp2
import tweepy

URL_CALLBACK = '/app/oauthcb'
MAX_AGE_REQUEST = 3  # 3分
MAX_AGE_ACCESS = 30  # 30日
FILE_KEYS = 'application.txt'

class OAuth(webapp2.RequestHandler):
  def get(self):
    import Cookie
    from datetime import datetime, timedelta

    callback = 'http://' + self.request.environ['HTTP_HOST'] + URL_CALLBACK
    (consumer_key, consumer_secret) = readKeys()
    auth = tweepy.OAuthHandler(consumer_key, consumer_secret, callback)

    try:
      auth_url = auth.get_authorization_url()
    except:
      self.redirect('/blank.html')
      return

    expires = datetime.now() + timedelta(minutes=MAX_AGE_REQUEST)
    monster = Cookie.SimpleCookie()
    monster['request_token_key'] = auth.request_token.key
    monster['request_token_key']['path'] = '/'
    monster['request_token_key']['expires'] = expires.strftime("%a, %d-%b-%Y %H:%M:%S GMT")
    monster['request_token_secret'] = auth.request_token.secret
    monster['request_token_secret']['path'] = '/'
    monster['request_token_secret']['expires'] = expires.strftime("%a, %d-%b-%Y %H:%M:%S GMT")
    self.response.headers.add_header("Set-Cookie", monster['request_token_key'].output(header=''))
    self.response.headers.add_header("Set-Cookie", monster['request_token_secret'].output(header=''))

    self.redirect(auth_url)


class OAuthCB(webapp2.RequestHandler):
  def get(self):
    import Cookie
    from datetime import datetime, timedelta

    oauth_verifier = self.request.get('oauth_verifier')
    (consumer_key, consumer_secret) = readKeys()
    auth = tweepy.OAuthHandler(consumer_key, consumer_secret)

    request_token_key = self.request.cookies.get('request_token_key')
    request_token_secret = self.request.cookies.get('request_token_secret')

    auth.set_request_token(request_token_key, request_token_secret)

    try:
      auth.get_access_token(oauth_verifier)
    except:
      self.redirect('/blank.html')
      return

    expires = datetime.now() + timedelta(days=MAX_AGE_ACCESS)
    monster = Cookie.SimpleCookie()
    monster['access_token_key'] = auth.access_token.key
    monster['access_token_key']['path'] = '/'
    monster['access_token_key']['expires'] = expires.strftime("%a, %d-%b-%Y %H:%M:%S GMT")
    monster['access_token_secret'] = auth.access_token.secret
    monster['access_token_secret']['path'] = '/'
    monster['access_token_secret']['expires'] = expires.strftime("%a, %d-%b-%Y %H:%M:%S GMT")
    self.response.headers.add_header("Set-Cookie", monster['access_token_key'].output(header=''))
    self.response.headers.add_header("Set-Cookie", monster['access_token_secret'].output(header=''))

    self.redirect('/')


class RateLimitStatus(webapp2.RequestHandler):
  def get(self):
    oauth_api = getApi(self)

    (res, resp) = oauth_api.rate_limit_status()

    self.response.headers['Content-Type'] = 'application/json; charset=utf-8'
    self.response.write(res)


class Search(webapp2.RequestHandler):
  def get(self):
    oauth_api = getApi(self)

    (res, resp) = oauth_api.search(
      q = self.request.get('q'),
      geocode = self.request.get('geocode'),
      lang = self.request.get('lang'),
      locale = self.request.get('locale'),
      result_type = self.request.get('result_type'),
      count = self.request.get('count'),
      until = self.request.get('until'),
      since_id = self.request.get('since_id'),
      max_id = self.request.get('max_id'),
      include_entities = self.request.get('include_entities')
    )

    self.response.headers['Content-Type'] = 'application/json; charset=utf-8'
    self.response.headers['X-RateLimit-Limit'] = resp.getheader('x-rate-limit-limit')
    self.response.headers['X-RateLimit-Remaining'] = resp.getheader('x-rate-limit-remaining')
    self.response.headers['X-RateLimit-Reset'] = resp.getheader('x-rate-limit-reset')
    self.response.write(res)


class GetStatus(webapp2.RequestHandler):
  def get(self):
    oauth_api = getApi(self)

    (res, resp) = oauth_api.get_status(
      id = self.request.get('id'),
      include_entities = self.request.get('include_entities')
    )

    self.response.headers['Content-Type'] = 'application/json; charset=utf-8'
    self.response.headers['X-RateLimit-Limit'] = resp.getheader('x-rate-limit-limit')
    self.response.headers['X-RateLimit-Remaining'] = resp.getheader('x-rate-limit-remaining')
    self.response.headers['X-RateLimit-Reset'] = resp.getheader('x-rate-limit-reset')
    self.response.write(res)


def getApi(self):
  from tweepy.parsers import RawParser  #JSON Raw データで受け取る

  access_token_key = self.request.cookies.get('access_token_key')
  access_token_secret = self.request.cookies.get('access_token_secret')

  (consumer_key, consumer_secret) = readKeys()
  auth = tweepy.OAuthHandler(consumer_key, consumer_secret)
  auth.set_access_token(access_token_key, access_token_secret)
  return tweepy.API(auth_handler = auth, parser = RawParser())

def readKeys():
  with open(FILE_KEYS) as f:
    line = f.read()
  (key, secret) = line.split(',')
  return key, secret

app = webapp2.WSGIApplication([
  ('/app/getstatus', GetStatus),
  ('/app/oauth', OAuth),
  ('/app/oauthcb', OAuthCB),
  ('/app/ratelimitstatus', RateLimitStatus),
  ('/app/search', Search)
], debug=True)

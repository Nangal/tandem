import { URIProtocol, IURIProtocolReadResult } from "./protocol";
// import fs = require("fs");
import http = require("http");
import https = require("https");
import Url = require("url");
import request = require("request");

export class HTTPURIProtocol extends URIProtocol {

  // private _watchers: any = {};
  // private _writes: any = {};

  private _responses: {
    [Identifier: string]: {
      etag: string,
      modifiedAt: string
    }
  } = {};

  async read(uri: string): Promise<IURIProtocolReadResult> {
    this.logger.info(`http GET ${uri}`);

    return new Promise<IURIProtocolReadResult>((resolve, reject) => {
      

      request({ 
        url: uri, 
        followAllRedirects: true, 
        gzip: true,
        headers: {
          "cache-control": "max-age=3600"
        }
      }, (err, response, body) => {

        if (err) return reject(err);

        this._storeResponseInfo(uri, response);

        if (!/^20/.test(String(response.statusCode))) {
          return reject(new Error(`Unable to load: ${response.statusCode}`));
        }

        let contentType = response.headers["content-type"];
        if (contentType) contentType = contentType.split(";").shift();

        resolve({
          type: contentType,
          content: body
        });
      });
  
    });
  }

  private _storeResponseInfo(uri, response) {
    this._responses[uri] = {
      modifiedAt: response.headers["last-modified"] || new Date().toString(),
      etag: response.headers.etag,
    }
  }
  async write(uri: string, content: string) {
    return new Promise((resolve, reject) => {
      request.post(uri, {
        body: content
      });

      resolve();
    })
  }
  async fileExists(uri: string) {
    // this.logger.info(`Cannot currenty check http 404s`);
    return true;
  }
  watch2(uri: string, onChange: () => any) {
    // this._watchers[uri] = onChange;
    let _disposed: boolean;


    // TODO - actually check for content change from server
    const check = () => {
      if (_disposed) return;
      // const prevResponse = this._responses[uri] || { modifiedAt: undefined, etag: undefined };

      // this.logger.debug(`check for change: ${uri}`);
      // request.get({ 
      //   uri: uri,
      //   headers: {
      //     "if-modified-since": prevResponse.modifiedAt,
      //     "if-none-match": prevResponse.etag,
      //   }
      // }).on("response", (response) => {
      //   response.destroy();

      //   if (/^20/.test(String(response.statusCode))) {
      //     this._storeResponseInfo(uri, response);
      //     onChange();
      //   }
      // });

      // checkTimeout();
    };
    
    const checkTimeout = setTimeout.bind(this, check, 1000 * 3);
    checkTimeout();

    return {
      dispose() {
        _disposed = true;
      }
    }
  }
}
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaInterface } from "@aws-lambda-powertools/commons";

const TOTP = require("totp-generator");
const TOTP_TTL_IN_SECONDS = 30;
const TOTP_HASH = "SHA-512";
const TOTP_LENGTH = 8;

export class TotpHandler implements LambdaInterface {
  public async handler(
    event: any,
    _context: unknown
  ): Promise<APIGatewayProxyResult | any> {
    const totp_code = TOTP(event.SecretString, {
      algorithm: TOTP_HASH,
      period: TOTP_TTL_IN_SECONDS,
      timestamp: Date.now(),
      digits: TOTP_LENGTH,
    });
    return {
      totp: totp_code
    }
  }
}

const handlerClass = new TotpHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
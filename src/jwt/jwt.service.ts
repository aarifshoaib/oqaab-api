import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class JwtService {
    private readonly merchantId = 'cyboqaabgene_1748680837';
    private readonly keyId = '369b136c-0794-413f-ae3c-4683e6db0ac9';
    private readonly privateKey: string;

    constructor() {
        const keyPath = path.join(process.cwd(), 'src/jwt/oqaab.ppk');
        this.privateKey = fs.readFileSync(keyPath, 'utf8');
    }

    generateJWT(payloadBody: any): string {
        const rawBody = JSON.stringify(payloadBody);
        const digest = crypto
            .createHash('sha256')
            .update(rawBody)
            .digest('base64');

        const header = {
            alg: 'RS256',
            kid: this.keyId,
            'v-c-merchant-id': this.merchantId,
        };

        const claims = {
            iat: Math.floor(Date.now() / 1000), 
            digest,
            digestAlgorithm: 'SHA-256',
        };

        const token = jwt.sign(claims, this.privateKey, {
            algorithm: 'RS256',
            header,
        });

        return token;
    }
}

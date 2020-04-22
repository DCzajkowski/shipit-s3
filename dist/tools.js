"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const recursive_readdir_1 = __importDefault(require("recursive-readdir"));
const aws_sdk_1 = require("aws-sdk");
const mime_types_1 = __importDefault(require("mime-types"));
const github_1 = require("@actions/github");
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const credentials = new aws_sdk_1.Credentials({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
});
const s3Client = new aws_sdk_1.S3({
    apiVersion: '2006-03-01',
    region: AWS_REGION,
    credentials,
});
exports.prUpdatedAction = (source, destination, customURL) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log('>', 'prUpdatedAction', { source, destination });
    const filesPaths = yield recursive_readdir_1.default(source);
    console.log('>', 'filesPaths', filesPaths);
    const uploadPromises = filesPaths.map((filePath) => __awaiter(void 0, void 0, void 0, function* () {
        const s3Key = `${destination}/${filePath.replace(source, '').replace(/^\/+/, '')}`;
        const fileBuffer = yield fs_1.promises.readFile(filePath);
        const mimeType = mime_types_1.default.lookup(filePath) || 'application/octet-stream';
        console.log('>', 'uploadPromise', s3Key, mimeType);
        console.log('>', 'details', {
            Bucket: AWS_S3_BUCKET,
            Key: s3Key,
            Body: fileBuffer,
            ACL: 'public-read',
            ServerSideEncryption: 'AES256',
            ContentType: mimeType,
            CacheControl: 'max-age=0,no-cache,no-store,must-revalidate',
        });
        yield s3Client
            .putObject({
            Bucket: AWS_S3_BUCKET,
            Key: s3Key,
            Body: fileBuffer,
            ACL: 'public-read',
            ServerSideEncryption: 'AES256',
            ContentType: mimeType,
            CacheControl: 'max-age=0,no-cache,no-store,must-revalidate',
        })
            .promise();
    }));
    yield Promise.all(uploadPromises);
    if (github_1.context.payload.action === 'labeled') {
        const { number } = (_a = github_1.context.payload) === null || _a === void 0 ? void 0 : _a.pull_request;
        const { owner, repo } = github_1.context.repo;
        const oktokit = new github_1.GitHub(GITHUB_TOKEN);
        const deploymentURL = `${customURL}/${destination}/en/`;
        yield oktokit.pulls.createReview({
            owner,
            repo,
            pull_number: number,
            event: 'COMMENT',
            body: `Your PR contents were deployed to ${deploymentURL} 🛳`,
        });
    }
});
exports.prClosedAction = (destination) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('PR Closed Action');
});

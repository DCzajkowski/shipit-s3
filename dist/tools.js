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
    console.log('>', 'prUpdatedAction triggered with arguments', { source, destination });
    const filesPaths = yield recursive_readdir_1.default(source);
    const uploadPromises = filesPaths.map((filePath) => __awaiter(void 0, void 0, void 0, function* () {
        const s3Key = `${destination}/${filePath.replace(source, '').replace(/^\/+/, '')}`;
        const fileBuffer = yield fs_1.promises.readFile(filePath);
        const mimeType = mime_types_1.default.lookup(filePath) || 'application/octet-stream';
        console.log('>', 'Uploading file', s3Key, 'with Content-Type', mimeType, 'to bucket', AWS_S3_BUCKET);
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
    console.log('>', 'Uploaded all files');
    if (github_1.context.payload.action === 'labeled') {
        const deploymentURL = `${customURL}/${destination}/en/`;
        console.log('>', 'The PR was labeled. Creating a review with link', deploymentURL);
        const { number } = (_a = github_1.context.payload) === null || _a === void 0 ? void 0 : _a.pull_request;
        const { owner, repo } = github_1.context.repo;
        const oktokit = new github_1.GitHub(GITHUB_TOKEN);
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
    var _b;
    console.log('>', 'prClosedAction triggered with arguments', { destination });
    console.log('>', 'Getting all files connected to this PR from bucket', AWS_S3_BUCKET);
    const objects = yield s3Client
        .listObjects({
        Bucket: AWS_S3_BUCKET,
        Prefix: destination,
    })
        .promise();
    const objectsKeys = (_b = objects.Contents) === null || _b === void 0 ? void 0 : _b.filter(({ Key }) => Key !== undefined).map(({ Key }) => ({ Key }));
    if (objectsKeys === undefined || objectsKeys.length === 0) {
        console.log('>', 'There are no files connected to this PR. Doing nothing...');
        return;
    }
    console.log('>', 'Removing files', objectsKeys.map(({ Key }) => Key), 'from bucket', AWS_S3_BUCKET);
    yield s3Client
        .deleteObjects({
        Bucket: AWS_S3_BUCKET,
        Delete: {
            Objects: objectsKeys,
            Quiet: false,
        },
    })
        .promise();
});

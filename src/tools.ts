import { promises as fs } from 'fs'
import readdir from 'recursive-readdir'
import { Credentials, S3 } from 'aws-sdk'
import mimeTypes from 'mime-types'
import { context, GitHub } from '@actions/github'

const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET as string
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID as string
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY as string
const AWS_REGION = process.env.AWS_REGION as string
const GITHUB_TOKEN = process.env.GITHUB_TOKEN as string

const credentials = new Credentials({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
})

const s3Client = new S3({
  apiVersion: '2006-03-01',
  region: AWS_REGION,
  credentials,
})

export const prUpdatedAction = async (source: string, destination: string, customURL: string) => {
  console.log('>', 'prUpdatedAction', { source, destination })

  const filesPaths = await readdir(source)

  console.log('>', 'filesPaths', filesPaths)

  const uploadPromises = filesPaths.map(async (filePath) => {
    const s3Key = `${destination}/${filePath.replace(source, '').replace(/^\/+/, '')}`

    const fileBuffer = await fs.readFile(filePath)
    const mimeType = mimeTypes.lookup(filePath) || 'application/octet-stream'

    console.log('>', 'uploadPromise', s3Key, mimeType)

    console.log('>', 'details', {
      Bucket: AWS_S3_BUCKET,
      Key: s3Key,
      Body: fileBuffer,
      ACL: 'public-read',
      ServerSideEncryption: 'AES256',
      ContentType: mimeType,
      CacheControl: 'max-age=0,no-cache,no-store,must-revalidate',
    })

    await s3Client
      .putObject({
        Bucket: AWS_S3_BUCKET,
        Key: s3Key,
        Body: fileBuffer,
        ACL: 'public-read',
        ServerSideEncryption: 'AES256',
        ContentType: mimeType,
        CacheControl: 'max-age=0,no-cache,no-store,must-revalidate',
      })
      .promise()
  })

  await Promise.all(uploadPromises)

  if (context.payload.action === 'labeled') {
    const { number } = context.payload?.pull_request!
    const { owner, repo } = context.repo

    const oktokit = new GitHub(GITHUB_TOKEN)

    const deploymentURL = `${customURL}/${destination}/en/`

    await oktokit.pulls.createReview({
      owner,
      repo,
      pull_number: number,
      event: 'COMMENT',
      body: `Your PR contents were deployed to ${deploymentURL} 🛳`,
    })
  }
}

export const prClosedAction = async (destination: string) => {
  console.log('PR Closed Action')
}

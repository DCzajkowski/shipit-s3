import * as core from '@actions/core'
import { context } from '@actions/github'
import { prUpdatedAction, prClosedAction } from './tools'

const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY
const AWS_REGION = process.env.AWS_REGION
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

async function main() {
  if (!AWS_S3_BUCKET || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !GITHUB_TOKEN) {
    throw new Error('One or more required env variables not set.')
  }

  const sourceDirectory = core.getInput('source-directory')
  const destinationDirectory = core.getInput('destination-directory')
  const customURL = core.getInput('custom-url')

  if (context.eventName !== 'pull_request') {
    console.log('The event does not apply to a PR. Skiping...')
    return
  }

  switch (context.payload.action) {
    case 'opened':
    case 'reopened':
    case 'synchronize':
    case 'labeled':
      await prUpdatedAction(sourceDirectory, destinationDirectory, customURL)
      break

    case 'closed':
      await prClosedAction(destinationDirectory)
      break

    default:
      console.log('PR not created, modified or deleted. Skiping...')
      break
  }
}

try {
  main()
} catch (error) {
  core.error(error)
  core.setFailed(error.message)
}

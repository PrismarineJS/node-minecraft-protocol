# Cross-Repository Workflow Trigger Setup

This document explains how to set up cross-repository workflow triggering between the minecraft-data repository and this repository.

## Overview

The workflow `update-from-minecraft-data.yml` can be triggered from the minecraft-data repository in two ways:

1. **Manual Workflow Dispatch** - Triggered manually or programmatically
2. **Repository Dispatch** - Triggered via webhook/API call

## Setup in minecraft-data repository

### Method 1: Workflow Dispatch (Recommended)

Add this step to a workflow in the minecraft-data repository:

```yaml
- name: Trigger update in node-minecraft-protocol
  uses: actions/github-script@v7
  with:
    github-token: ${{ secrets.CROSS_REPO_TOKEN }}
    script: |
      await github.rest.actions.createWorkflowDispatch({
        owner: 'extremeheat',
        repo: 'node-minecraft-protocol',
        workflow_id: 'update-from-minecraft-data.yml',
        ref: 'master', // or the target branch
        inputs: {
          trigger_source: 'minecraft-data',
          trigger_reason: 'data_update',
          data_version: '${{ steps.get_version.outputs.version }}' // or your version variable
        }
      });
```

### Method 2: Repository Dispatch

```yaml
- name: Trigger update in node-minecraft-protocol
  uses: actions/github-script@v7
  with:
    github-token: ${{ secrets.CROSS_REPO_TOKEN }}
    script: |
      await github.rest.repos.createDispatchEvent({
        owner: 'extremeheat',
        repo: 'node-minecraft-protocol',
        event_type: 'minecraft-data-update',
        client_payload: {
          repository: 'minecraft-data',
          reason: 'data_update',
          version: '${{ steps.get_version.outputs.version }}'
        }
      });
```

## Required Secrets

You need to create a Personal Access Token (PAT) with the following permissions:
- `repo` scope (for private repositories)
- `public_repo` scope (for public repositories)
- `actions:write` permission

Add this token as a secret named `CROSS_REPO_TOKEN` in the minecraft-data repository.

## Token Setup Steps

1. Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. Generate a new token with appropriate permissions
3. Add the token as `CROSS_REPO_TOKEN` secret in minecraft-data repository settings

## Customizing the Updator Script

The updator script (`.github/helper/updator.js`) can be customized to:

- Download and process minecraft-data updates
- Update protocol definitions
- Run tests to verify compatibility
- Create pull requests for review
- Send notifications

## Testing

You can test the workflow manually by:

1. Going to the Actions tab in this repository
2. Selecting "Update from minecraft-data" workflow
3. Clicking "Run workflow"
4. Providing test inputs

## Security Considerations

- Use repository secrets for sensitive tokens
- Limit token permissions to minimum required
- Consider using short-lived tokens or GitHub Apps for enhanced security
- Review and approve automatic commits/PRs if needed

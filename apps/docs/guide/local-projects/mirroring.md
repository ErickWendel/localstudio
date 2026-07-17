# Mirroring

Mirroring syncs a local project folder to S3-compatible storage so assets and public share payloads can be reachable outside the local machine.

## Mirror Settings

The editor supports endpoint, bucket, region, writer access key, writer secret key, reader access key, reader secret key, public base URL, prefix, and path-style URL settings.

Use writer credentials for project sync, public share publishing, and remote mirror cleanup. Use reader credentials for read-only deck access, imports, and public deck viewers. When you make a deck public, configure a read-only reader API key so people opening the public URL can load the deck payload and assets without getting credentials that can write or modify presentations.

The local MinIO compose file creates these development credentials:

- Writer: `localstudio-writer` / `localstudio-writer`
- Reader: `localstudio-reader` / `localstudio-reader`
- Root console login: `localstudio-root` / `localstudio-root123`

## Use Carefully

Scope credentials to the bucket or prefix you intend to use. Browser-stored credentials stay in this browser profile.

> WIP
> Add a GIF of testing mirror settings and running Mirror Now.

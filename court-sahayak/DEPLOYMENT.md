# Deploying Court Sahayak

This package is ready to deploy as a Docker web application. It contains the website, the Node API, and an SQLite database.

## Local production check

```powershell
docker build -t court-sahayak .
docker run --rm -p 4173:4173 -v "${PWD}/data:/app/data" -e APP_USERNAME=admin -e APP_PASSWORD=change-this-password court-sahayak
```

Open `http://localhost:4173`. The mounted `data` directory is essential: it retains `court-sahayak.sqlite` and uploaded documents across deployments.

## Deploy on a container host

Use any Docker-capable host (Render, Railway, Fly.io, Azure App Service, Google Cloud Run with a persistent volume, or a VPS).

1. Upload this folder to a Git repository or directly to the host.
2. Build from the included `Dockerfile`.
3. Attach a persistent disk mounted at `/app/data`.
4. Set `DATA_DIR=/app/data`.
5. Set a strong `APP_USERNAME` and `APP_PASSWORD` for the included basic protection.
6. Let the platform supply `PORT`; HTTPS should be terminated by the platform.

## Important security boundary

This is appropriate for a demo or controlled internal prototype. Do not place real court, client, or personally identifiable information in a public deployment. Before production use, add organization SSO, role-based access, MFA, encrypted backups, database encryption, server-side virus scanning, retention controls, comprehensive audit logs, and a legal/security review.

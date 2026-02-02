# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in CloudCounter, please report it responsibly.

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please send an email or open a private security advisory:

1. **GitHub Security Advisory**: Go to the [Security tab](https://github.com/philippdubach/cloudcounter/security/advisories) and click "Report a vulnerability"
2. **Email**: Contact the maintainer directly

### What to Include

When reporting a vulnerability, please include:

- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes (if available)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Resolution timeline**: Depends on severity, typically 30-90 days

## Security Considerations

CloudCounter is designed with privacy in mind:

- **No cookies**: Session tracking uses hashed IP + User-Agent, not cookies
- **No PII storage**: Personal data is hashed, not stored in plaintext
- **Dashboard protection**: Password-protected access to analytics data
- **Edge deployment**: Runs on Cloudflare's edge infrastructure with built-in DDoS protection

## Best Practices for Deployment

1. **Use a strong dashboard password**: Set via `wrangler secret put DASHBOARD_PASSWORD`
2. **Keep dependencies updated**: Regularly run `npm update`
3. **Use HTTPS**: Cloudflare Pages provides this automatically
4. **Review access**: Only share dashboard credentials with authorized users

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Acknowledgments

We appreciate security researchers who help keep CloudCounter safe. Contributors who report valid vulnerabilities will be acknowledged (with permission) in release notes.

<div align="center">

# NEXA

### Multi-Tenant Business Management SaaS Platform

**Designed & Developed by Hamzeh Almomani**

A full-stack business management application built to help
organizations manage their daily operations securely and efficiently.

[View Source Code](https://github.com/hamzehalmomani03/NEXA)

</div>

---

## About the Project

NEXA is a full-stack Software-as-a-Service (SaaS) project
focused on business operations, organization management,
secure access control, and a modern user experience.

The application is designed around a multi-tenant architecture,
where organizations manage their own users and business data.

## Key Features

- Multi-tenant organization management
- Secure JWT-based authentication
- Organization-based roles and permissions
- Employee email invitations and invitation registration
- Team member role management
- Employee account activation and deactivation
- Product and inventory management
- Customer management
- Sales management
- User profile and account settings
- Responsive business dashboard and interface

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Database Hosting | Neon |
| Authentication | JWT |
| Email | SMTP |
| Version Control | Git, GitHub |

## Project Structure

```text
NEXA/
|-- frontend/       React + TypeScript application
|-- backend/        NestJS API and business logic
|-- COPYRIGHT.md    Copyright and ownership notice
|-- README.md       Project overview
```

## Architecture Highlights

### Multi-Tenant Design

NEXA uses organization-based data separation to support
multiple businesses within a single application.

### Role-Based Access Control

Organization members are assigned roles that determine
which administrative and business actions they can perform.

### Employee Invitations

Authorized organization members can invite employees
through email-based invitation workflows.

### Business Operations

The application includes modules for working with
products, inventory, sales, and customers.

## Development

The frontend and backend are organized as separate
applications.

See the documentation inside each application folder
for its existing setup information.

- `frontend/README.md`
- `backend/README.md`

Environment-specific credentials must be provided
privately and must never be committed to this repository.

## Project Purpose

NEXA is a portfolio project demonstrating practical
full-stack software engineering skills, including:

- Frontend application development
- REST API development
- Database modeling
- Authentication and authorization
- Multi-tenant application design
- Business logic implementation
- Full-stack integration

## Author

**Hamzeh Almomani**

GitHub: [@hamzehalmomani03](https://github.com/hamzehalmomani03)

## Copyright

Copyright (c) 2026 Hamzeh Almomani.
All rights reserved.

This repository is publicly available for portfolio
review and technical evaluation.

Public access does not grant a general license to
reuse, redistribute, or commercially exploit the
original proprietary code.

See [COPYRIGHT.md](./COPYRIGHT.md) for details.
Third-party components remain subject to their
respective licenses.

---

<div align="center">

**NEXA — Built by Hamzeh Almomani**

</div>

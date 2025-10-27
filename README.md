Nexis ERP + E-commerce

Nexis ERP is an integrated business management system designed to optimize operations for multiple industries, including optical, hardware, and retail. It provides a modular and scalable architecture capable of handling complex processes across inventory, sales, users, and analytics.

Overview

Nexis ERP combines enterprise resource planning with modern e-commerce functionality in a single platform.
It was built with clean architecture principles, ensuring flexibility, scalability, and security at every layer.

Core Features

Modular multi-company system with isolated database collections

Complete inventory and order management

Role-based authentication and authorization using JWT

Real-time communication through Server-Sent Events (SSE)

RESTful API architecture for integration with external services

Reporting and analytics with customizable dashboards

Modern and responsive frontends for both web and Android

Technology Stack

Backend:

Node.js

Express.js

MongoDB with Mongoose

JWT Authentication

Server-Sent Events (SSE)

FastAPI (Python microservices)

Frontend:

React.js (Web Interface)

Kotlin (Android App)

Infrastructure & Tools:

Docker

PM2

Vercel

Postman

Git / GitHub

System Architecture

The system is structured with a micro-modular architecture:

Core Services: User, Auth, Company, System Configurations

Manager Services: Product, Inventory, Orders, Categories

E-commerce Services: Public Catalog, Checkout, Customer Management

Integration Layer: API Gateway and SSE streams for live updates

Client Layer: React and Kotlin consuming secured REST APIs

Objectives

Provide an extensible ERP system adaptable to different business types

Maintain high performance through asynchronous operations and caching strategies

Ensure data isolation per company to support multi-tenant deployments

Facilitate easy integration with third-party tools and services

Future Roadmap

Integration of advanced analytics and automated reporting

AI-based assistant for internal task automation and customer support

Cloud-based synchronization between ERP modules and mobile clients

Expansion to support PostgreSQL for hybrid data persistence

Author

Developed by: Nexis Plataforms
Role: Software Engineer – Backend and System Architecture
Contact: xalorplataforms@gmail.com

# OAuth Webpage

This project is a simple webpage that demonstrates how to authenticate with an API service using OAuth and make API calls.

## Project Structure

```
oauth-webpage
├── src
│   ├── index.html       # Main HTML document for the webpage
│   ├── app.js           # JavaScript code for OAuth authentication and API calls
│   └── styles.css       # CSS styles for the webpage
├── package.json          # Configuration file for npm
└── README.md             # Documentation for the project
```

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   cd oauth-webpage
   ```

2. Install the required dependencies:
   ```
   npm install
   ```

3. Open `src/index.html` in your browser to view the webpage.

## Usage Guidelines

- The webpage will initiate the OAuth flow when the user clicks the "Login" button.
- After successful authentication, the user will be redirected back to the application.
- The application will then be able to make authenticated API calls on behalf of the user.

## OAuth Implementation

This project uses OAuth for authentication. Ensure you have the necessary credentials (client ID, client secret, redirect URI) from your API service provider. Update the `app.js` file with your credentials to enable the OAuth flow.

## License

This project is licensed under the MIT License.
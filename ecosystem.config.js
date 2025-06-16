module.exports = {
    apps: [{
        name: 'nestjs-app',
        script: 'dist/main.js',
        instances: 'max', // Use all CPU cores
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'development'
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 3000
        }
    }]
  };
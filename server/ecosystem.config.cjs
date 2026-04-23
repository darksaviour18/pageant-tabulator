{
  "apps": [
    {
      "name": "pageant-server",
      "script": "src/server.js",
      "instances": 1,
      "exec_mode": "cluster",
      "watch": false,
      "env": {
        "NODE_ENV": "production"
      },
      "error_file": "logs/error.log",
      "out_file": "logs/out.log",
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "autorestart": true,
      "max_restarts": 10,
      "min_uptime": "10s",
      "max_memory_restart": "500M",
      "graceful_timeout": 5000
    }
  ]
}
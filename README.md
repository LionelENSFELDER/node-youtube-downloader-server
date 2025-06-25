# node-youtube-downloader-server

A node server to convert youtube links to mp3

## Test download with local server

```bash
curl -v -X POST http://localhost:3001/download   -H "Content-Type: application/json"   -d '{"url":"https://www.youtube.com/watch?v=dpvQqmX6SUI"}'   --output keep-watching.m4a   --progress-bar
```

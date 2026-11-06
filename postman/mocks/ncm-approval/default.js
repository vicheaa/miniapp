// Local verification only. Request fields follow the NCM payload supplied by
// the API owner; success responses use the existing client's JSON convention.
const http = require('node:http');
let submissions = [];
let failNext = false;

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.end();
  if (req.url === '/__test/reset') {
    submissions = [];
    failNext = false;
    return res.end('{}');
  }
  if (req.url === '/__test/fail-next') {
    failNext = true;
    return res.end('{}');
  }
  if (req.url === '/__test/submissions') return res.end(JSON.stringify(submissions));
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (req.method === 'POST' && req.url === '/services/central/api/upload/multi') {
    return res.end(JSON.stringify([{ fileId: 'ncm-evidence', publicUrl: '' }]));
  }
  if (req.method === 'POST' && req.url === '/services/workflow/api/v1/workflow/name/completeTask/exec') {
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    if (!['Approved', 'Rejected'].includes(payload.action)
      || payload.payloadType !== 'ncm_stock_request_function_approval'
      || payload.taskId !== 'ncm-task'
      || JSON.stringify(payload.payloadData) !== '{}'
      || !payload.comment?.trim()
      || !Array.isArray(payload.uploadedFiles)
      || payload.fetchCurrentTask !== false) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ message: 'Invalid NCM approval payload' }));
    }
    if (failNext) {
      failNext = false;
      res.statusCode = 500;
      return res.end(JSON.stringify({ message: 'Simulated submission failure' }));
    }
    submissions.push(payload);
    return res.end('{}');
  }
  res.statusCode = 501;
  res.end(JSON.stringify({ message: 'Endpoint not modeled for this simulation' }));
}).listen(process.env.PORT);

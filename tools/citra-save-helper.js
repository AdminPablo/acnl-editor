const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.ACNL_SAVE_HELPER_PORT || 38765);
const DEFAULT_CITRA_SAVE_DIR = path.join(
	process.env.APPDATA || '',
	'Citra',
	'sdmc',
	'Nintendo 3DS',
	'00000000000000000000000000000000',
	'00000000000000000000000000000000',
	'title',
	'00040000',
	'00198f00',
	'data',
	'00000001'
);
const SIZE_BY_NAME = {
	'garden.dat':522752,
	'garden_plus.dat':563968
};

function getTargetPath(fileName){
	const configuredTarget = process.argv[2] || process.env.ACNL_CITRA_SAVE_TARGET || process.env.ACNL_CITRA_SAVE_DIR || DEFAULT_CITRA_SAVE_DIR;
	if(path.extname(configuredTarget).toLowerCase()==='.dat')
		return configuredTarget;
	return path.join(configuredTarget, fileName);
}

function send(res, status, text){
	res.writeHead(status, {
		'Access-Control-Allow-Origin':'*',
		'Access-Control-Allow-Methods':'POST, OPTIONS',
		'Access-Control-Allow-Headers':'Content-Type, X-ACNL-Filename',
		'Content-Type':'text/plain; charset=utf-8'
	});
	res.end(text);
}

function getFileName(req){
	const headerName = req.headers['x-acnl-filename'];
	const fileName = path.basename(headerName || 'garden_plus.dat');
	return SIZE_BY_NAME[fileName]? fileName : false;
}

const server = http.createServer((req, res) => {
	if(req.method==='OPTIONS')
		return send(res, 204, '');

	if(req.method!=='POST' || req.url.split('?')[0]!=='/save')
		return send(res, 404, 'Not found');

	const fileName = getFileName(req);
	if(!fileName)
		return send(res, 400, 'Invalid AC:NL save filename');

	const chunks = [];
	let total = 0;
	req.on('data', chunk => {
		total += chunk.length;
		if(total>1024*1024){
			send(res, 413, 'Save file is too large');
			req.destroy();
			return;
		}
		chunks.push(chunk);
	});

	req.on('end', () => {
		const buffer = Buffer.concat(chunks);
		if(buffer.length!==SIZE_BY_NAME[fileName])
			return send(res, 400, `Invalid ${fileName} size: ${buffer.length}`);

		const targetPath = getTargetPath(fileName);
		const targetDir = path.dirname(targetPath);
		try{
			fs.mkdirSync(targetDir, {recursive:true});
			if(fs.existsSync(targetPath))
				fs.copyFileSync(targetPath, `${targetPath}.bak`);
			fs.writeFileSync(targetPath, buffer);
			console.log(`Saved ${fileName} to ${targetPath}`);
			send(res, 200, targetPath);
		}catch(e){
			console.error(e);
			send(res, 500, e.message);
		}
	});
});

server.listen(PORT, '127.0.0.1', () => {
	console.log(`ACNL save helper listening on http://127.0.0.1:${PORT}/save`);
	console.log(`Default target directory: ${DEFAULT_CITRA_SAVE_DIR}`);
	console.log('Press Ctrl+C to stop.');
});

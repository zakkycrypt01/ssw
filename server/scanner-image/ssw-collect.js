const fs = require('node:fs');

const tools = ['cargo-audit', 'cargo-geiger', 'clippy', 'solana-fender'];
const result = {
  versions: {},
};

for (const tool of tools) {
  const fenderReport = tool === 'solana-fender' && fs.existsSync('/out/solana-fender.stdout')
    ? fs.readFileSync('/out/solana-fender.stdout', 'utf8')
    : '';

  result[tool] = {
    status: Number(fs.existsSync(`/out/${tool}.status`) ? fs.readFileSync(`/out/${tool}.status`, 'utf8') : 127),
    stdout: fenderReport || (fs.existsSync(`/out/${tool}.stdout`) ? fs.readFileSync(`/out/${tool}.stdout`, 'utf8') : ''),
    stderr: fs.existsSync(`/out/${tool}.stderr`) ? fs.readFileSync(`/out/${tool}.stderr`, 'utf8') : '',
  };
}

fs.writeFileSync('/out/ssw-results.json', JSON.stringify(result));

const si = require('systeminformation');

async function testMetrics() {
  const temp = await si.cpuTemperature();
  console.log('Temperature:', temp);
  const cpu = await si.currentLoad();
  console.log('CPU Load:', cpu.currentLoad);
}

testMetrics();

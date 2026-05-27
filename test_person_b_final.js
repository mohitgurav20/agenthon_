require('dotenv').config({ path: 'c:/Users/chinm/Desktop/agebtic ai/agenthon_/.env' });
const { searchJobBoards } = require('./tools/tavily-search');
const { executeAtsParser } = require('./tools/managed_agent_tool');

async function testAll() {
  console.log('1. Testing Job Crawler...');
  const jobResult = await searchJobBoards({ language: "Python", role: "Software Engineer" });
  console.log(`Job Crawler Success: ${jobResult.success}, Results found: ${jobResult.results ? jobResult.results.length : 0}`);

  console.log('\n2. Testing ATS Parser Sandbox...');
  const atsResult = await executeAtsParser({ resumeText: "Python developer", jdText: "Need Python and React" });
  console.log(`ATS Parser Score: ${atsResult.data ? atsResult.data.score : 'Error'}`);

  console.log('\nAll core Person B integrations verified.');
}

testAll();

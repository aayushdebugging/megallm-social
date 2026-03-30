import fs from 'fs';
const data = JSON.parse(fs.readFileSync('.pipeline-state/content_queue.json', 'utf8'));

// Reset first 3 items to pending
data.slice(0, 3).forEach(item => {
  item.status = 'pending';
});

fs.writeFileSync('.pipeline-state/content_queue.json', JSON.stringify(data, null, 2), 'utf8');

console.log('Updated first 3 items:');
data.slice(0, 3).forEach((item, i) => {
  console.log(`${i+1}. status=${item.status}, title=${item.title.substring(0, 50)}...`);
});

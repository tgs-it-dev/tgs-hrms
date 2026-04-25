const fs = require('fs');
const path = require('path');
const filePath = '/Users/Saad/tgs_projects/tgs-hrms/src/modules/geofence/geofence.service.ts';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/const repo = em \? em\.getRepository\(Geofence\) : repo;/g, 'const repo = em ? em.getRepository(Geofence) : this.repo;');
content = content.replace(/const teamRepo = em \? em\.getRepository\(Team\) : teamRepo;/g, 'const teamRepo = em ? em.getRepository(Team) : this.teamRepo;');
content = content.replace(/const employeeRepo = em \? em\.getRepository\(Employee\) : employeeRepo;/g, 'const employeeRepo = em ? em.getRepository(Employee) : this.employeeRepo;');

fs.writeFileSync(filePath, content, 'utf8');

export interface ResumeData {
  name?: string;
  contactInfo?: string;
  tagline?: string;
  locationPref?: string;
  overviewBullets?: string[];
  technicalSkills?: { category: string; skills: string }[];
  functionalSkills?: string[];
  organisationalScan?: string[];
  mainProjectTitle?: string;
  otherProjects?: string[];
  significantHighlights?: { company: string; bullets: string[] }[];
  academicCredentials?: string;
  dateOfBirth?: string;
  residentialAddress?: string;
}

const renderList = (items: string[] = []) => items.map(b => `<li>${b}</li>`).join('');

const renderHighlights = (highlights: any[] = []) => highlights.map(h => `
  <div class="highlight-group">
    <div class="company-name">${h.company}</div>
    <ul>${(h.bullets || []).map((b: string) => `<li>${b}</li>`).join('')}</ul>
  </div>
`).join('');

const printButtonStr = `
  <div class="no-print print-header">
    <button onclick="window.print()" class="print-btn">⬇ Download / Save PDF</button>
    <div class="print-hint">Make sure "Background graphics" is checked in print settings for the best look!</div>
  </div>
`;

const baseStyles = `
  <style>
    @media print {
      .no-print { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
    }
    .print-header {
      background: #0f172a; color: white; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; font-family: system-ui, sans-serif;
    }
    .print-btn {
      background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: background 0.2s;
    }
    .print-btn:hover { background: #2563eb; }
    .print-hint { font-size: 13px; color: #94a3b8; }
  </style>
`;

export const templates = [
  {
    id: 'harvard',
    name: 'Harvard Classic (ATS Master)',
    render: (data: ResumeData) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${data.name || 'Resume'}</title>
  ${baseStyles}
  <style>
    body { font-family: "Times New Roman", Times, serif; line-height: 1.3; color: #000; margin: 0; padding: 0; background: #fff; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    h1 { text-align: center; font-size: 24px; text-transform: uppercase; margin: 0 0 5px 0; border-bottom: 1px solid #000; }
    .contact { text-align: center; font-size: 12px; margin-bottom: 20px; }
    h2 { font-size: 14px; text-transform: uppercase; border-bottom: 1px solid #000; margin: 15px 0 5px 0; padding-bottom: 2px; }
    .company-name { font-weight: bold; margin-top: 10px; }
    ul { margin: 5px 0 15px 0; padding-left: 20px; font-size: 12px; }
    li { margin-bottom: 4px; }
    p { font-size: 12px; margin: 5px 0; }
  </style>
</head>
<body>
  ${printButtonStr}
  <div class="container">
    <h1>${data.name || ''}</h1>
    <div class="contact">${data.contactInfo || ''} | ${data.locationPref || ''}</div>
    
    <h2>Summary</h2>
    <ul>${renderList(data.overviewBullets)}</ul>

    <h2>Experience & Highlights</h2>
    ${(data.organisationalScan || []).map(o => `<p><strong>${o}</strong></p>`).join('')}
    ${renderHighlights(data.significantHighlights)}

    <h2>Projects</h2>
    <p><strong>Main Project:</strong> ${data.mainProjectTitle || ''}</p>
    <ul>${renderList(data.otherProjects)}</ul>

    <h2>Skills</h2>
    <ul>
      ${(data.technicalSkills || []).map(ts => `<li><strong>${ts.category}:</strong> ${ts.skills}</li>`).join('')}
      ${(data.functionalSkills || []).map(fs => `<li>${fs}</li>`).join('')}
    </ul>

    <h2>Education & Additional Info</h2>
    <p>${data.academicCredentials || ''}</p>
  </div>
</body>
</html>`
  },
  {
    id: 'minimalist',
    name: 'Modern Minimalist',
    render: (data: ResumeData) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${data.name || 'Resume'}</title>
  ${baseStyles}
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; line-height: 1.5; color: #333; margin: 0; padding: 0; background: #fff; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    header { margin-bottom: 30px; }
    h1 { font-size: 32px; font-weight: 800; margin: 0; color: #111; letter-spacing: -0.5px; }
    .tagline { font-size: 14px; color: #666; font-weight: 500; margin-top: 4px; }
    .contact { font-size: 12px; color: #888; margin-top: 8px; }
    h2 { font-size: 16px; font-weight: 600; color: #111; text-transform: uppercase; letter-spacing: 1px; margin: 25px 0 10px 0; border-bottom: 2px solid #eee; padding-bottom: 5px; }
    .company-name { font-weight: 600; font-size: 14px; color: #222; margin-top: 12px; }
    ul { margin: 8px 0; padding-left: 18px; font-size: 13px; color: #444; }
    li { margin-bottom: 6px; }
    p { font-size: 13px; margin: 6px 0; }
  </style>
</head>
<body>
  ${printButtonStr}
  <div class="container">
    <header>
      <h1>${data.name || ''}</h1>
      <div class="tagline">${data.tagline || ''}</div>
      <div class="contact">${data.contactInfo || ''} • ${data.locationPref || ''}</div>
    </header>
    
    <h2>Professional Summary</h2>
    <ul>${renderList(data.overviewBullets)}</ul>

    <h2>Experience</h2>
    ${(data.organisationalScan || []).map(o => `<p>• ${o}</p>`).join('')}
    ${renderHighlights(data.significantHighlights)}

    <h2>Technical Projects</h2>
    <p><strong>${data.mainProjectTitle || ''}</strong></p>
    <ul>${renderList(data.otherProjects)}</ul>

    <h2>Skills Overview</h2>
    <ul>
      ${(data.technicalSkills || []).map(ts => `<li><strong>${ts.category}:</strong> ${ts.skills}</li>`).join('')}
    </ul>

    <h2>Education</h2>
    <p>${data.academicCredentials || ''}</p>
  </div>
</body>
</html>`
  },
  {
    id: 'executive',
    name: 'Executive Navy',
    render: (data: ResumeData) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${data.name || 'Resume'}</title>
  ${baseStyles}
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.5; margin: 0; padding: 0; background: #fff; color: #333; }
    .container { max-width: 800px; margin: 0 auto; }
    .header { background: #0f2027; background: linear-gradient(to right, #0f2027, #203a43, #2c5364); color: white; padding: 40px; text-align: center; }
    h1 { margin: 0; font-size: 36px; letter-spacing: 2px; text-transform: uppercase; }
    .tagline { font-size: 16px; margin-top: 10px; color: #a8d5e2; }
    .contact-bar { background: #1a1a1a; color: #ccc; padding: 10px 40px; font-size: 12px; text-align: center; }
    .content { padding: 40px; }
    h2 { color: #2c5364; font-size: 18px; text-transform: uppercase; border-bottom: 2px solid #2c5364; padding-bottom: 5px; margin-top: 25px; }
    .company-name { font-weight: bold; font-size: 15px; color: #0f2027; margin-top: 15px; }
    ul { padding-left: 20px; font-size: 13.5px; }
    li { margin-bottom: 6px; }
    .skills-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 13px; }
  </style>
</head>
<body>
  ${printButtonStr}
  <div class="container">
    <div class="header">
      <h1>${data.name || ''}</h1>
      <div class="tagline">${data.tagline || ''}</div>
    </div>
    <div class="contact-bar">
      ${data.contactInfo || ''} | ${data.locationPref || ''}
    </div>
    <div class="content">
      <h2>Executive Summary</h2>
      <ul>${renderList(data.overviewBullets)}</ul>

      <h2>Professional Experience</h2>
      ${(data.organisationalScan || []).map(o => `<p style="font-size:13.5px;font-weight:bold;">${o}</p>`).join('')}
      ${renderHighlights(data.significantHighlights)}

      <h2>Key Projects</h2>
      <p style="font-weight:bold;font-size:14px;">${data.mainProjectTitle || ''}</p>
      <ul>${renderList(data.otherProjects)}</ul>

      <h2>Core Competencies</h2>
      <div class="skills-grid">
        ${(data.technicalSkills || []).map(ts => `<div><strong>${ts.category}:</strong><br/>${ts.skills}</div>`).join('')}
      </div>

      <h2>Education & Details</h2>
      <p style="font-size:13.5px;">${data.academicCredentials || ''}</p>
    </div>
  </div>
</body>
</html>`
  },
  {
    id: 'startup',
    name: 'Tech Startup',
    render: (data: ResumeData) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${data.name || 'Resume'}</title>
  ${baseStyles}
  <style>
    body { font-family: 'Roboto', sans-serif; color: #2d3748; margin: 0; background: #fff; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { border-left: 5px solid #4299e1; padding-left: 20px; margin-bottom: 30px; }
    h1 { font-size: 32px; color: #1a202c; margin: 0; }
    .contact { font-family: monospace; font-size: 13px; color: #718096; margin-top: 10px; }
    h2 { font-size: 18px; color: #2b6cb0; margin: 25px 0 15px 0; display: flex; align-items: center; }
    h2::after { content: ""; flex: 1; height: 1px; background: #e2e8f0; margin-left: 15px; }
    .company-name { font-weight: bold; font-size: 15px; color: #2d3748; }
    .skill-badge { display: inline-block; background: #edf2f7; color: #4a5568; padding: 4px 10px; border-radius: 4px; font-size: 12px; margin: 3px; font-family: monospace; }
    ul { padding-left: 20px; font-size: 13.5px; line-height: 1.6; }
  </style>
</head>
<body>
  ${printButtonStr}
  <div class="container">
    <div class="header">
      <h1>${data.name || ''}</h1>
      <div style="font-size: 16px; color: #4a5568; margin-top: 5px;">${data.tagline || ''}</div>
      <div class="contact">${data.contactInfo || ''} | ${data.locationPref || ''}</div>
    </div>
    
    <h2>About</h2>
    <ul>${renderList(data.overviewBullets)}</ul>

    <h2>Experience</h2>
    ${renderHighlights(data.significantHighlights)}

    <h2>Projects: ${data.mainProjectTitle || ''}</h2>
    <ul>${renderList(data.otherProjects)}</ul>

    <h2>Tech Stack</h2>
    <div>
      ${(data.technicalSkills || []).map(ts => ts.skills.split(',').map(s => `<span class="skill-badge">${s.trim()}</span>`).join('')).join('')}
    </div>

    <h2>Education</h2>
    <p style="font-size:14px;">${data.academicCredentials || ''}</p>
  </div>
</body>
</html>`
  },
  {
    id: 'serif_elegant',
    name: 'Elegant Serif',
    render: (data: ResumeData) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${data.name || 'Resume'}</title>
  ${baseStyles}
  <style>
    body { font-family: "Georgia", serif; line-height: 1.6; color: #222; margin: 0; background: #fff; }
    .container { max-width: 800px; margin: 0 auto; padding: 50px 40px; }
    h1 { font-size: 38px; text-align: center; font-weight: normal; margin: 0; letter-spacing: 1px; }
    .tagline { text-align: center; font-style: italic; color: #555; margin-top: 10px; }
    .contact { text-align: center; font-size: 12px; color: #666; margin-top: 15px; border-bottom: 1px solid #ddd; padding-bottom: 20px; }
    h2 { font-size: 16px; font-weight: bold; text-transform: uppercase; text-align: center; letter-spacing: 2px; margin: 30px 0 20px 0; }
    .company-name { font-weight: bold; font-size: 14px; text-transform: uppercase; }
    ul { padding-left: 20px; font-size: 13.5px; color: #333; }
    li { margin-bottom: 8px; text-align: justify; }
  </style>
</head>
<body>
  ${printButtonStr}
  <div class="container">
    <h1>${data.name || ''}</h1>
    <div class="tagline">${data.tagline || ''}</div>
    <div class="contact">${data.contactInfo || ''} | ${data.locationPref || ''}</div>
    
    <h2>Profile</h2>
    <ul>${renderList(data.overviewBullets)}</ul>

    <h2>Professional Experience</h2>
    ${renderHighlights(data.significantHighlights)}

    <h2>Projects & Initiatives</h2>
    <p style="text-align: center; font-weight: bold; font-size: 14px;">${data.mainProjectTitle || ''}</p>
    <ul>${renderList(data.otherProjects)}</ul>

    <h2>Skills & Expertise</h2>
    <ul>
      ${(data.technicalSkills || []).map(ts => `<li><strong>${ts.category}:</strong> ${ts.skills}</li>`).join('')}
    </ul>

    <h2>Education</h2>
    <p style="text-align: center; font-size: 14px;">${data.academicCredentials || ''}</p>
  </div>
</body>
</html>`
  },
  {
    id: 'split',
    name: 'Compact Split',
    render: (data: ResumeData) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${data.name || 'Resume'}</title>
  ${baseStyles}
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; background: #fff; color: #333; line-height: 1.4; }
    .container { max-width: 850px; margin: 0 auto; display: flex; min-height: 100vh; }
    .left { width: 30%; background: #2c3e50; color: #fff; padding: 30px 20px; }
    .right { width: 70%; padding: 30px 40px; }
    h1 { font-size: 28px; margin: 0 0 10px 0; line-height: 1.1; }
    h2 { font-size: 16px; border-bottom: 2px solid #3498db; padding-bottom: 4px; margin-top: 0; color: #2c3e50; }
    .left h2 { border-bottom-color: #34495e; color: #ecf0f1; font-size: 14px; margin-top: 25px; }
    .contact-item { font-size: 12px; margin-bottom: 10px; color: #bdc3c7; }
    .skill-cat { font-weight: bold; font-size: 12px; color: #3498db; margin-top: 15px; }
    .skill-text { font-size: 11.5px; color: #ecf0f1; }
    .company-name { font-weight: bold; font-size: 14px; color: #2980b9; margin-top: 15px; }
    ul { padding-left: 15px; font-size: 12.5px; }
    li { margin-bottom: 5px; }
  </style>
</head>
<body>
  ${printButtonStr}
  <div class="container">
    <div class="left">
      <h1>${data.name || ''}</h1>
      <div style="font-size:13px; color:#3498db; margin-bottom: 30px;">${data.tagline || ''}</div>
      
      <h2>Contact</h2>
      <div class="contact-item">${data.contactInfo || ''}</div>
      <div class="contact-item">${data.locationPref || ''}</div>
      
      <h2>Skills</h2>
      ${(data.technicalSkills || []).map(ts => `<div class="skill-cat">${ts.category}</div><div class="skill-text">${ts.skills}</div>`).join('')}
      
      <h2>Education</h2>
      <div class="skill-text">${data.academicCredentials || ''}</div>
    </div>
    <div class="right">
      <h2>Profile</h2>
      <ul>${renderList(data.overviewBullets)}</ul>
      
      <h2 style="margin-top:25px;">Experience</h2>
      ${renderHighlights(data.significantHighlights)}
      
      <h2 style="margin-top:25px;">Projects: ${data.mainProjectTitle || ''}</h2>
      <ul>${renderList(data.otherProjects)}</ul>
    </div>
  </div>
</body>
</html>`
  },
  {
    id: 'accent',
    name: 'Bold Accent',
    render: (data: ResumeData) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${data.name || 'Resume'}</title>
  ${baseStyles}
  <style>
    body { font-family: 'Helvetica', sans-serif; margin: 0; background: #fff; color: #111; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    h1 { font-size: 42px; margin: 0; color: #e11d48; text-transform: lowercase; font-weight: 900; letter-spacing: -1px; }
    .header-info { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 4px solid #111; padding-bottom: 10px; margin-bottom: 20px; }
    .contact { font-size: 12px; text-align: right; font-weight: 600; }
    h2 { background: #111; color: #fff; display: inline-block; padding: 4px 12px; font-size: 14px; text-transform: uppercase; margin: 20px 0 10px 0; }
    .company-name { font-weight: bold; font-size: 15px; color: #e11d48; margin-top: 15px; }
    ul { padding-left: 20px; font-size: 13px; line-height: 1.5; }
  </style>
</head>
<body>
  ${printButtonStr}
  <div class="container">
    <div class="header-info">
      <div>
        <h1>${data.name || ''}</h1>
        <div style="font-weight: bold; margin-top: 5px;">${data.tagline || ''}</div>
      </div>
      <div class="contact">${data.contactInfo || ''}<br/>${data.locationPref || ''}</div>
    </div>
    
    <h2>Summary</h2>
    <ul>${renderList(data.overviewBullets)}</ul>

    <h2>Experience</h2>
    ${renderHighlights(data.significantHighlights)}

    <h2>Projects</h2>
    <p style="font-weight:bold; font-size: 14px;">${data.mainProjectTitle || ''}</p>
    <ul>${renderList(data.otherProjects)}</ul>

    <h2>Technical Skills</h2>
    <ul>
      ${(data.technicalSkills || []).map(ts => `<li><strong>${ts.category}:</strong> ${ts.skills}</li>`).join('')}
    </ul>

    <h2>Education</h2>
    <p style="font-size:14px; font-weight:bold;">${data.academicCredentials || ''}</p>
  </div>
</body>
</html>`
  },
  {
    id: 'terminal',
    name: 'Developer Terminal',
    render: (data: ResumeData) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${data.name || 'Resume'}</title>
  ${baseStyles}
  <style>
    /* For PDF printing, we must use dark text on light background to save ink and ensure ATS reads it well, but we'll style it to look 'code-like' */
    body { font-family: 'Fira Code', 'Courier New', monospace; margin: 0; background: #fff; color: #333; line-height: 1.5; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    h1 { font-size: 24px; color: #059669; margin: 0; }
    h1::before { content: "> "; color: #333; }
    .comment { color: #6b7280; font-size: 13px; }
    h2 { font-size: 16px; color: #2563eb; margin: 25px 0 10px 0; border-bottom: 1px dashed #ccc; padding-bottom: 5px; }
    h2::before { content: "./"; color: #333; }
    .company-name { font-weight: bold; font-size: 14px; color: #059669; margin-top: 15px; }
    ul { list-style-type: square; padding-left: 20px; font-size: 13px; }
    li { margin-bottom: 6px; }
  </style>
</head>
<body>
  ${printButtonStr}
  <div class="container">
    <h1>${data.name || ''}</h1>
    <div class="comment">/* ${data.tagline || ''} */</div>
    <div class="comment">/* ${data.contactInfo || ''} | ${data.locationPref || ''} */</div>
    
    <h2>cat summary.txt</h2>
    <ul>${renderList(data.overviewBullets)}</ul>

    <h2>ls -la ./experience</h2>
    ${renderHighlights(data.significantHighlights)}

    <h2>git log --projects</h2>
    <p style="font-weight:bold;">[HEAD] ${data.mainProjectTitle || ''}</p>
    <ul>${renderList(data.otherProjects)}</ul>

    <h2>cat package.json | jq .skills</h2>
    <ul>
      ${(data.technicalSkills || []).map(ts => `<li><strong>"${ts.category}":</strong> [${ts.skills.split(',').map(s=>`"${s.trim()}"`).join(', ')}]</li>`).join('')}
    </ul>

    <h2>cat education.txt</h2>
    <p style="font-size:13px;">${data.academicCredentials || ''}</p>
  </div>
</body>
</html>`
  },
  {
    id: 'corporate',
    name: 'Corporate Standard',
    render: (data: ResumeData) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${data.name || 'Resume'}</title>
  ${baseStyles}
  <style>
    body { font-family: 'Arial', sans-serif; margin: 0; background: #fff; color: #000; line-height: 1.4; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    h1 { font-size: 26px; text-align: center; margin: 0 0 10px 0; color: #333; }
    .contact { text-align: center; font-size: 12px; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
    h2 { font-size: 14px; text-transform: uppercase; background: #eee; padding: 6px 10px; margin: 20px 0 10px 0; color: #333; }
    .company-name { font-weight: bold; font-size: 13.5px; margin-top: 10px; }
    ul { padding-left: 20px; font-size: 12.5px; }
    li { margin-bottom: 5px; }
  </style>
</head>
<body>
  ${printButtonStr}
  <div class="container">
    <h1>${data.name || ''}</h1>
    <div class="contact">
      ${data.contactInfo || ''}<br/>
      ${data.locationPref || ''} | ${data.tagline || ''}
    </div>
    
    <h2>Professional Summary</h2>
    <ul>${renderList(data.overviewBullets)}</ul>

    <h2>Work Experience</h2>
    ${renderHighlights(data.significantHighlights)}

    <h2>Projects</h2>
    <p style="font-weight:bold; font-size: 13.5px; margin-left: 10px;">${data.mainProjectTitle || ''}</p>
    <ul>${renderList(data.otherProjects)}</ul>

    <h2>Skills</h2>
    <ul>
      ${(data.technicalSkills || []).map(ts => `<li><strong>${ts.category}:</strong> ${ts.skills}</li>`).join('')}
    </ul>

    <h2>Education</h2>
    <p style="margin-left: 10px; font-size: 13px;">${data.academicCredentials || ''}</p>
  </div>
</body>
</html>`
  },
  {
    id: 'creative',
    name: 'Creative Glass',
    render: (data: ResumeData) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${data.name || 'Resume'}</title>
  ${baseStyles}
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;700&display=swap');
    body { font-family: 'Outfit', sans-serif; margin: 0; background: #fafafa; color: #1e293b; line-height: 1.6; }
    /* In PDF, background patterns don't always print well unless forced, but it looks great in browser */
    .container { max-width: 800px; margin: 40px auto; padding: 40px; background: white; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
    header { text-align: center; margin-bottom: 40px; }
    h1 { font-size: 40px; font-weight: 700; margin: 0; background: linear-gradient(135deg, #6366f1, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .tagline { font-size: 16px; font-weight: 500; color: #64748b; margin-top: 5px; }
    .contact { font-size: 13px; color: #94a3b8; margin-top: 15px; }
    h2 { font-size: 18px; font-weight: 700; color: #334155; margin: 30px 0 15px 0; display: flex; align-items: center; gap: 10px; }
    h2::before { content: ""; display: block; width: 12px; height: 12px; border-radius: 50%; background: #a855f7; }
    .company-name { font-weight: 700; font-size: 15px; color: #1e293b; margin-top: 20px; }
    ul { padding-left: 20px; font-size: 14px; color: #475569; }
    li { margin-bottom: 8px; }
    .pill { display: inline-block; padding: 4px 12px; background: #f1f5f9; color: #6366f1; border-radius: 20px; font-size: 12px; font-weight: 500; margin: 4px; }
  </style>
</head>
<body>
  ${printButtonStr}
  <div class="container">
    <header>
      <h1>${data.name || ''}</h1>
      <div class="tagline">${data.tagline || ''}</div>
      <div class="contact">${data.contactInfo || ''} • ${data.locationPref || ''}</div>
    </header>
    
    <h2>Summary</h2>
    <ul>${renderList(data.overviewBullets)}</ul>

    <h2>Experience</h2>
    ${renderHighlights(data.significantHighlights)}

    <h2>Projects: ${data.mainProjectTitle || ''}</h2>
    <ul>${renderList(data.otherProjects)}</ul>

    <h2>Skills</h2>
    <div style="margin-bottom: 20px;">
      ${(data.technicalSkills || []).map(ts => ts.skills.split(',').map(s => `<span class="pill">${s.trim()}</span>`).join('')).join('')}
    </div>

    <h2>Education</h2>
    <p style="font-size:14px; font-weight:500;">${data.academicCredentials || ''}</p>
  </div>
</body>
</html>`
  }
];

/**
 * Profile Extractor Tool
 * Handles extracting candidate data from GitHub and LinkedIn.
 */

async function extractGithubProfile(username) {
  try {
    const res = await fetch(`https://api.github.com/users/${username}`);
    if (!res.ok) throw new Error('GitHub user not found');
    const user = await res.json();
    
    // Fetch repos
    const repoRes = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=5`);
    const repos = await repoRes.json();
    
    const languages = new Set();
    const projects = repos.map(repo => {
      if (repo.language) languages.add(repo.language);
      return {
        name: repo.name,
        description: repo.description,
        url: repo.html_url,
        language: repo.language
      };
    });

    return {
      source: 'GitHub',
      name: user.name || user.login,
      bio: user.bio,
      company: user.company,
      location: user.location,
      publicRepos: user.public_repos,
      followers: user.followers,
      topLanguages: Array.from(languages),
      recentProjects: projects
    };
  } catch (error) {
    console.error('Error fetching GitHub profile:', error);
    return null;
  }
}

async function extractLinkedInProfile(url) {
  // Since real LinkedIn scraping requires authentication or a paid API (like Proxycurl),
  // we use a simulated data extraction for the hackathon that mirrors a typical JSON response.
  // In production, this would call Proxycurl or a dedicated scraping microservice.
  console.log(`[Profile Extractor] Simulating LinkedIn scrape for ${url}...`);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        source: 'LinkedIn',
        url: url,
        headline: 'Software Engineer | React | Node.js | Generative AI',
        summary: 'Passionate full-stack developer with a strong background in building scalable web applications and integrating AI models. Experienced in React, Node.js, and Cloud Infrastructure.',
        experience: [
          {
            title: 'Senior Software Engineer',
            company: 'Tech Innovators Inc.',
            duration: '2021 - Present',
            description: 'Led the transition to a microservices architecture. Improved application performance by 40% using Redis caching and optimized PostgreSQL queries.'
          },
          {
            title: 'Software Developer',
            company: 'Web Solutions LLC',
            duration: '2018 - 2021',
            description: 'Developed and maintained core features of the flagship SaaS product using React and Express.'
          }
        ],
        education: [
          {
            degree: 'B.S. in Computer Science',
            institution: 'University of Technology',
            year: '2018'
          }
        ],
        skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'AWS', 'Docker', 'PostgreSQL']
      });
    }, 1500); // Simulate network latency
  });
}

module.exports = {
  extractGithubProfile,
  extractLinkedInProfile
};

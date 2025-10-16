/**
 * Resume Service for parsing and extracting information from uploaded resumes
 */

export interface ResumeData {
  skills: string[];
  projects: string[];
  achievements: string[];
  experience: string[];
  education: string[];
}

export class ResumeService {
  /**
   * Parse resume text and extract relevant information
   */
  async parseResume(resumeText: string): Promise<ResumeData> {
    try {
      // Extract skills
      const skills = this.extractSkills(resumeText);
      
      // Extract projects
      const projects = this.extractProjects(resumeText);
      
      // Extract achievements
      const achievements = this.extractAchievements(resumeText);
      
      // Extract experience
      const experience = this.extractExperience(resumeText);
      
      // Extract education
      const education = this.extractEducation(resumeText);

      return {
        skills,
        projects,
        achievements,
        experience,
        education
      };
    } catch (error) {
      console.error('Error parsing resume:', error);
      return {
        skills: [],
        projects: [],
        achievements: [],
        experience: [],
        education: []
      };
    }
  }

  /**
   * Extract skills from resume text
   */
  private extractSkills(text: string): string[] {
    const skills: string[] = [];
    const lowerText = text.toLowerCase();

    // Common technical skills
    const technicalSkills = [
      'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust',
      'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask',
      'mongodb', 'mysql', 'postgresql', 'redis', 'elasticsearch',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins',
      'git', 'github', 'gitlab', 'jira', 'confluence',
      'html', 'css', 'sass', 'less', 'bootstrap', 'tailwind',
      'machine learning', 'ai', 'data science', 'analytics',
      'agile', 'scrum', 'devops', 'ci/cd', 'microservices'
    ];

    technicalSkills.forEach(skill => {
      if (lowerText.includes(skill)) {
        skills.push(skill);
      }
    });

    // Look for skills section
    const skillsSectionRegex = /(?:skills?|technologies?|technical skills?)[:\s]*([^.\n]+)/i;
    const skillsMatch = text.match(skillsSectionRegex);
    
    if (skillsMatch) {
      const skillsText = skillsMatch[1];
      const additionalSkills = skillsText
        .split(/[,;|&]/)
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0 && skill.length < 50);
      
      skills.push(...additionalSkills);
    }

    return [...new Set(skills)]; // Remove duplicates
  }

  /**
   * Extract projects from resume text
   */
  private extractProjects(text: string): string[] {
    const projects: string[] = [];
    
    // Look for projects section
    const projectsSectionRegex = /(?:projects?|portfolio|work)[:\s]*([^.\n]+)/i;
    const projectsMatch = text.match(projectsSectionRegex);
    
    if (projectsMatch) {
      const projectsText = projectsMatch[1];
      const projectList = projectsText
        .split(/[,;|&]/)
        .map(project => project.trim())
        .filter(project => project.length > 0 && project.length < 100);
      
      projects.push(...projectList);
    }

    // Look for bullet points that might be projects
    const bulletPoints = text.match(/^[\s]*[•\-\*]\s*(.+)$/gm);
    if (bulletPoints) {
      bulletPoints.forEach(point => {
        const cleanPoint = point.replace(/^[\s]*[•\-\*]\s*/, '').trim();
        if (cleanPoint.length > 10 && cleanPoint.length < 100) {
          // Check if it looks like a project description
          if (cleanPoint.match(/(?:built|developed|created|designed|implemented)/i)) {
            projects.push(cleanPoint);
          }
        }
      });
    }

    return [...new Set(projects)]; // Remove duplicates
  }

  /**
   * Extract achievements from resume text
   */
  private extractAchievements(text: string): string[] {
    const achievements: string[] = [];
    
    // Look for achievements section
    const achievementsSectionRegex = /(?:achievements?|accomplishments?|awards?)[:\s]*([^.\n]+)/i;
    const achievementsMatch = text.match(achievementsSectionRegex);
    
    if (achievementsMatch) {
      const achievementsText = achievementsMatch[1];
      const achievementList = achievementsText
        .split(/[,;|&]/)
        .map(achievement => achievement.trim())
        .filter(achievement => achievement.length > 0 && achievement.length < 100);
      
      achievements.push(...achievementList);
    }

    // Look for quantified achievements in bullet points
    const bulletPoints = text.match(/^[\s]*[•\-\*]\s*(.+)$/gm);
    if (bulletPoints) {
      bulletPoints.forEach(point => {
        const cleanPoint = point.replace(/^[\s]*[•\-\*]\s*/, '').trim();
        // Look for quantified achievements (numbers, percentages, etc.)
        if (cleanPoint.match(/\d+%|\d+\+|\d+x|\$\d+|\d+% increase|\d+% reduction/i)) {
          achievements.push(cleanPoint);
        }
      });
    }

    return [...new Set(achievements)]; // Remove duplicates
  }

  /**
   * Extract work experience from resume text
   */
  private extractExperience(text: string): string[] {
    const experience: string[] = [];
    
    // Look for experience section
    const experienceSectionRegex = /(?:experience|work history|employment)[:\s]*([^.\n]+)/i;
    const experienceMatch = text.match(experienceSectionRegex);
    
    if (experienceMatch) {
      const experienceText = experienceMatch[1];
      const experienceList = experienceText
        .split(/[,;|&]/)
        .map(exp => exp.trim())
        .filter(exp => exp.length > 0 && exp.length < 100);
      
      experience.push(...experienceList);
    }

    return [...new Set(experience)]; // Remove duplicates
  }

  /**
   * Extract education from resume text
   */
  private extractEducation(text: string): string[] {
    const education: string[] = [];
    
    // Look for education section
    const educationSectionRegex = /(?:education|academic|qualifications?)[:\s]*([^.\n]+)/i;
    const educationMatch = text.match(educationSectionRegex);
    
    if (educationMatch) {
      const educationText = educationMatch[1];
      const educationList = educationText
        .split(/[,;|&]/)
        .map(edu => edu.trim())
        .filter(edu => edu.length > 0 && edu.length < 100);
      
      education.push(...educationList);
    }

    return [...new Set(education)]; // Remove duplicates
  }
}

export const resumeService = new ResumeService();

/**
 * Extract and save resume data using backend API with Firebase fallback
 * This function is used by the Dashboard component
 */
export const extractAndSaveResume = async (
  userId: string,
  file: File
): Promise<{ resumeId: string; resumeData: ResumeData }> => {
  try {
    // First try backend API
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId);
      
      console.log('Uploading resume to backend API...');
      
      const response = await fetch('https://nerv-backend-qkm0.onrender.com/extract-skills', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Backend API response:', result);
        
        // The backend should return the extracted data
        const resumeData: ResumeData = {
          skills: result.skills || [],
          projects: result.projects || [],
          achievements: result.achievements || [],
          experience: result.experience || [],
          education: result.education || []
        };
        
        const resumeId = result.resumeId || `resume_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log('Resume data extracted from backend:', resumeData);
        
        // Save to Firebase as backup
        await saveResumeDataToFirebase(userId, resumeData);
        
        return {
          resumeId,
          resumeData
        };
      } else {
        console.warn('Backend API failed, falling back to local processing');
        throw new Error(`Backend API error: ${response.status}`);
      }
    } catch (backendError) {
      console.warn('Backend API failed, using local processing:', backendError);
      
      // Fallback to local processing
      const { extractTextFromPDF } = await import('./pdfService');
      const resumeText = await extractTextFromPDF(file);
      
      // Parse the resume text locally
      const resumeData = await resumeService.parseResume(resumeText);
      
      // Generate a unique resume ID
      const resumeId = `resume_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('Resume data extracted locally:', resumeData);
      
      // Save to Firebase
      await saveResumeDataToFirebase(userId, resumeData);
      
      return {
        resumeId,
        resumeData
      };
    }
  } catch (error) {
    console.error('Error extracting and saving resume:', error);
    throw error;
  }
};

/**
 * Save resume data to Firebase
 */
const saveResumeDataToFirebase = async (userId: string, resumeData: ResumeData): Promise<void> => {
  try {
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('../lib/firebase');
    
    console.log('Attempting to save resume data to Firebase for user:', userId);
    console.log('Resume data to save:', resumeData);
    
    // Save to Firebase
    const resumeDocRef = doc(db, 'users', userId, 'resumes', 'latest');
    const dataToSave = {
      ...resumeData,
      uploadedAt: new Date(),
      userId: userId
    };
    
    console.log('Saving to Firestore path: users/', userId, '/resumes/latest');
    console.log('Data being saved:', dataToSave);
    
    await setDoc(resumeDocRef, dataToSave);
    
    console.log('✅ Resume data saved to Firebase successfully');
  } catch (error) {
    console.error('❌ Error saving resume data to Firebase:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code || 'Unknown code',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    throw error;
  }
};
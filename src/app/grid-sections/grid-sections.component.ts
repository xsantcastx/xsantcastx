// grid-sections.component.ts
import { Component } from '@angular/core';

interface GridItem {
  title: string;
  content: string;
  active: boolean;
}

@Component({
    selector: 'app-grid-sections',
    templateUrl: './grid-sections.component.html',
    styleUrls: ['./grid-sections.component.css'],
    standalone: false
})
export class GridSectionsComponent {
  gridItems: GridItem[] = [
    {
      title: 'Professional Summary',
      content: `
<section class="resume-section">
  <div class="container">
    <h2>Professional Summary</h2>
    <p><strong>Santiago Castrillon</strong> – Senior Data Engineer &amp; Web Developer</p>
    <ul>
      <li>
        Result-oriented data engineer with extensive experience in building scalable, distributed data solutions, delivering
        a wide range of big data and analytics services, and driving technological innovations with cloud platforms.
      </li>
      <li>
        Proficient in modern cloud technologies and DevOps practices including AWS, Azure DevOps, EC2, S3, RDS, and EKS, along with
        expertise in version control systems like GitHub, GitFlow, and trunk-based development.
      </li>
      <li>
        Adept at full-stack web development and skilled in data modeling, ETL, and process automation using Python, SQL, VBA, and Java.
      </li>
    </ul>
    <div class="experience">
      <h3>Key Experience</h3>
      <p><strong>SENIOR DATA ENGINEER - ANALYST, BANCOLOMBIA (2019 – 2022)</strong></p>
      <p>
        Led the construction of a settlement and analytics platform from scratch—processing over 1.8 billion records from more than
        40 database systems to detect fraud and money laundering.
      </p>
      <p>
        Developed interactive XML-to-Excel converters and robust ETL solutions that significantly reduced project time and costs.
      </p>
    </div>
    <div class="education">
      <h3>Education &amp; Certifications</h3>
      <p>
        <strong>Advanced Course in Web Page Programming</strong> – Finalizing coursework (2025)
      </p>
      <p>
        <strong>Scrum Master Certification</strong> – Expected Certification (2025)
      </p>
      <p>
        <strong>Bachelor's in Systems Engineering</strong> – Instituto Universitario de Envigado (Graduated: 2020)
      </p>
    </div>
  </div>
</section>
      `,
      active: false,
    },
    {
      title: 'About Me',
      content: `
        <p>I’m xsantcastx—a glitch in the matrix, builder of digital curiosities with coastal roots and futuristic visions.</p>
        <p>I experiment, break things, and reinvent norms in code, art, and innovation.</p>
      `,
      active: false,
    },
    {
      title: 'Crypto',
      content: `
        <p>Passionate about blockchain and cryptocurrencies, I analyze market trends and explore decentralized technologies to stay ahead in the digital realm.</p>
      `,
      active: false,
    },
    {
      title: 'Gaming',
      content: `
        <p>From retro classics to modern AAA titles, I love exploring gaming culture, tech reviews, and insights into game development.</p>
      `,
      active: false,
    },
  ];

  toggleItem(index: number): void {
    // Toggle the selected grid item; collapse others if open
    this.gridItems.forEach((item, i) => {
      item.active = i === index ? !item.active : false;
    });
  }
}

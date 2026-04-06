export type NodeStatus = 'locked' | 'available' | 'completed';
export type QuestionType = 'multiple-choice' | 'true-false';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LessonContent {
  objective: string;
  sections: { title: string; body: string }[];
  keyTakeaways: string[];
}

export interface MapNode {
  id: string;
  title: string;
  description: string;
  x: number;
  y: number;
  prerequisites: string[];
  xpReward: number;
  estimatedMinutes: number;
  lesson: LessonContent;
  quiz: QuizQuestion[];
  isBonus?: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition: (progress: UserProgress) => boolean;
}

export interface UserProgress {
  completedNodes: string[];
  quizScores: Record<string, number>;
  xp: number;
  streak: number;
  lastActiveDate: string;
  achievements: string[];
  startDate: string;
}

export const DEFAULT_PROGRESS: UserProgress = {
  completedNodes: [],
  quizScores: {},
  xp: 0,
  streak: 0,
  lastActiveDate: '',
  achievements: [],
  startDate: new Date().toISOString(),
};

export const COURSE_NODES: MapNode[] = [
  {
    id: 'html-basics',
    title: 'HTML Foundations',
    description: 'The building blocks of every webpage',
    x: 50, y: 80,
    prerequisites: [],
    xpReward: 100,
    estimatedMinutes: 5,
    lesson: {
      objective: 'Understand HTML structure and core elements',
      sections: [
        { title: 'What is HTML?', body: 'HTML (HyperText Markup Language) is the standard language for creating web pages. It describes the structure of a web page using a series of elements that tell the browser how to display content. Every website you visit is built on HTML at its core.' },
        { title: 'Document Structure', body: 'Every HTML document starts with <!DOCTYPE html> followed by <html>, <head>, and <body> tags. The head contains metadata like the title and links to stylesheets, while the body contains all visible content. This hierarchy is the skeleton of every webpage.' },
        { title: 'Essential Elements', body: 'Key elements include headings (<h1> to <h6>), paragraphs (<p>), links (<a>), images (<img>), lists (<ul>, <ol>), and divs (<div>). These elements can be nested inside each other to create complex layouts and content structures.' },
      ],
      keyTakeaways: ['HTML provides structure to web content', 'Documents follow a head/body hierarchy', 'Elements are the building blocks of pages'],
    },
    quiz: [
      { id: 'q1', type: 'multiple-choice', question: 'What does HTML stand for?', options: ['Hyper Text Markup Language', 'High Tech Modern Language', 'Hyper Transfer Markup Language', 'Home Tool Markup Language'], correctIndex: 0, explanation: 'HTML stands for HyperText Markup Language, the standard markup language for creating web pages.' },
      { id: 'q2', type: 'true-false', question: 'The <head> element contains visible page content.', options: ['True', 'False'], correctIndex: 1, explanation: 'The <head> contains metadata. Visible content goes in the <body> element.' },
      { id: 'q3', type: 'multiple-choice', question: 'Which tag is used for the largest heading?', options: ['<heading>', '<h6>', '<h1>', '<big>'], correctIndex: 2, explanation: '<h1> is the largest heading, with <h6> being the smallest.' },
    ],
  },
  {
    id: 'css-basics',
    title: 'CSS Styling',
    description: 'Making things beautiful with styles',
    x: 30, y: 55,
    prerequisites: ['html-basics'],
    xpReward: 120,
    estimatedMinutes: 5,
    lesson: {
      objective: 'Learn how CSS controls the visual presentation of HTML',
      sections: [
        { title: 'What is CSS?', body: 'CSS (Cascading Style Sheets) controls the visual presentation of HTML elements. It handles colors, fonts, spacing, layout, and animations. Without CSS, websites would be plain text with default browser styling.' },
        { title: 'Selectors & Properties', body: 'CSS uses selectors to target HTML elements and properties to style them. You can select by element type (p), class (.intro), or ID (#header). Properties like color, font-size, margin, and padding control appearance.' },
        { title: 'The Box Model', body: 'Every element is a box with content, padding, border, and margin. Understanding this model is crucial for controlling layout. Padding adds space inside the element, borders wrap around padding, and margins create space between elements.' },
      ],
      keyTakeaways: ['CSS separates presentation from structure', 'Selectors target elements for styling', 'The box model governs element spacing'],
    },
    quiz: [
      { id: 'q1', type: 'multiple-choice', question: 'Which property changes text color?', options: ['font-color', 'text-color', 'color', 'foreground'], correctIndex: 2, explanation: 'The "color" property sets the text color in CSS.' },
      { id: 'q2', type: 'true-false', question: 'Margin is the space inside an element\'s border.', options: ['True', 'False'], correctIndex: 1, explanation: 'Margin is outside the border. Padding is inside the border.' },
      { id: 'q3', type: 'multiple-choice', question: 'How do you select an element with class "hero"?', options: ['#hero', '.hero', 'hero', '*hero'], correctIndex: 1, explanation: 'Classes are selected with a dot prefix: .hero' },
    ],
  },
  {
    id: 'js-basics',
    title: 'JavaScript Essentials',
    description: 'Adding interactivity to the web',
    x: 70, y: 55,
    prerequisites: ['html-basics'],
    xpReward: 150,
    estimatedMinutes: 5,
    lesson: {
      objective: 'Understand JavaScript fundamentals for web interactivity',
      sections: [
        { title: 'Why JavaScript?', body: 'JavaScript is the programming language of the web. It adds interactivity, handles user events, manipulates the DOM, and communicates with servers. Modern web apps are heavily driven by JavaScript.' },
        { title: 'Variables & Types', body: 'Variables store data using let, const, or var. JavaScript has types like strings ("hello"), numbers (42), booleans (true/false), arrays ([1,2,3]), and objects ({name: "Ada"}). const prevents reassignment while let allows it.' },
        { title: 'Functions & Events', body: 'Functions are reusable blocks of code. Arrow functions (const greet = () => {...}) are modern syntax. Event listeners let you respond to user actions like clicks, key presses, and form submissions.' },
      ],
      keyTakeaways: ['JavaScript adds behavior to web pages', 'Variables store data with different types', 'Functions and events drive interactivity'],
    },
    quiz: [
      { id: 'q1', type: 'multiple-choice', question: 'Which keyword declares a constant variable?', options: ['var', 'let', 'const', 'define'], correctIndex: 2, explanation: 'const declares a variable that cannot be reassigned.' },
      { id: 'q2', type: 'true-false', question: 'JavaScript can only run in web browsers.', options: ['True', 'False'], correctIndex: 1, explanation: 'JavaScript also runs server-side with Node.js and in many other environments.' },
      { id: 'q3', type: 'multiple-choice', question: 'What is the output of typeof []?', options: ['"array"', '"object"', '"list"', '"undefined"'], correctIndex: 1, explanation: 'Arrays are technically objects in JavaScript, so typeof returns "object".' },
    ],
  },
  {
    id: 'flexbox',
    title: 'Flexbox Layout',
    description: 'Master modern CSS layouts',
    x: 20, y: 30,
    prerequisites: ['css-basics'],
    xpReward: 130,
    estimatedMinutes: 4,
    lesson: {
      objective: 'Use Flexbox to create flexible, responsive layouts',
      sections: [
        { title: 'Flex Container', body: 'Setting display: flex on a container turns its children into flex items. The container controls the direction (row/column), wrapping, and alignment of all its children. This replaces many old float-based layout hacks.' },
        { title: 'Alignment', body: 'justify-content aligns items along the main axis (horizontal in row). align-items aligns along the cross axis (vertical in row). Common values: center, space-between, flex-start, flex-end, stretch.' },
        { title: 'Flex Items', body: 'Items can grow (flex-grow), shrink (flex-shrink), and have a base size (flex-basis). The shorthand flex: 1 makes an item grow to fill available space. Order property can rearrange items without changing HTML.' },
      ],
      keyTakeaways: ['Flexbox creates one-dimensional layouts', 'justify-content and align-items control alignment', 'flex-grow controls how items fill space'],
    },
    quiz: [
      { id: 'q1', type: 'multiple-choice', question: 'Which property creates a flex container?', options: ['flex: true', 'display: flex', 'layout: flex', 'position: flex'], correctIndex: 1, explanation: 'display: flex turns an element into a flex container.' },
      { id: 'q2', type: 'true-false', question: 'Flexbox is best for two-dimensional layouts.', options: ['True', 'False'], correctIndex: 1, explanation: 'Flexbox is for one-dimensional layouts. CSS Grid is for two-dimensional layouts.' },
    ],
  },
  {
    id: 'dom-manipulation',
    title: 'DOM Manipulation',
    description: 'Control the page dynamically',
    x: 75, y: 30,
    prerequisites: ['js-basics'],
    xpReward: 140,
    estimatedMinutes: 5,
    lesson: {
      objective: 'Learn to dynamically modify web pages using the DOM API',
      sections: [
        { title: 'The DOM Tree', body: 'The Document Object Model represents your HTML as a tree of nodes. JavaScript can access and modify any node. document.querySelector() finds elements using CSS selectors, returning the first match.' },
        { title: 'Modifying Elements', body: 'Change content with textContent or innerHTML. Modify styles with element.style or classList.add/remove/toggle. Create new elements with document.createElement() and append them to the page.' },
        { title: 'Event Handling', body: 'addEventListener attaches handlers to elements. Common events: click, input, submit, keydown, mouseover. Event delegation lets you handle events on parent elements for better performance with dynamic content.' },
      ],
      keyTakeaways: ['The DOM is a tree representation of HTML', 'querySelector finds elements by CSS selectors', 'Events drive user interaction handling'],
    },
    quiz: [
      { id: 'q1', type: 'multiple-choice', question: 'Which method selects an element by CSS selector?', options: ['getElementById', 'querySelector', 'getElement', 'findElement'], correctIndex: 1, explanation: 'querySelector uses CSS selectors to find elements.' },
      { id: 'q2', type: 'true-false', question: 'innerHTML is always safe to use with user input.', options: ['True', 'False'], correctIndex: 1, explanation: 'innerHTML can create XSS vulnerabilities. Use textContent for user input.' },
    ],
  },
  {
    id: 'responsive-design',
    title: 'Responsive Design',
    description: 'Build for every screen size',
    x: 40, y: 15,
    prerequisites: ['flexbox'],
    xpReward: 120,
    estimatedMinutes: 4,
    isBonus: true,
    lesson: {
      objective: 'Create designs that adapt to any screen size',
      sections: [
        { title: 'Media Queries', body: 'Media queries apply styles based on screen conditions. @media (max-width: 768px) targets screens 768px wide or less. Mobile-first design starts with small screens and adds complexity for larger ones.' },
        { title: 'Fluid Units', body: 'Use relative units like %, em, rem, vw, vh instead of fixed px. rem is relative to the root font size, making it predictable. vw/vh are percentages of viewport width/height for full-screen layouts.' },
        { title: 'Responsive Images', body: 'Use max-width: 100% to prevent images from overflowing. The srcset attribute provides different image sizes for different screens. The picture element offers art direction for different viewports.' },
      ],
      keyTakeaways: ['Media queries adapt styles to screen size', 'Relative units create fluid layouts', 'Mobile-first is the modern approach'],
    },
    quiz: [
      { id: 'q1', type: 'multiple-choice', question: 'What unit is relative to the root font size?', options: ['em', 'px', 'rem', 'vh'], correctIndex: 2, explanation: 'rem is relative to the root (<html>) element\'s font size.' },
      { id: 'q2', type: 'true-false', question: 'Mobile-first means designing for desktop first.', options: ['True', 'False'], correctIndex: 1, explanation: 'Mobile-first means starting with mobile styles and adding larger screen styles.' },
    ],
  },
  {
    id: 'async-js',
    title: 'Async JavaScript',
    description: 'Promises, async/await & APIs',
    x: 60, y: 10,
    prerequisites: ['dom-manipulation'],
    xpReward: 160,
    estimatedMinutes: 5,
    lesson: {
      objective: 'Handle asynchronous operations with Promises and async/await',
      sections: [
        { title: 'Why Async?', body: 'Network requests, file reading, and timers are asynchronous—they don\'t block code execution. JavaScript uses an event loop to handle these operations, keeping the UI responsive while waiting for results.' },
        { title: 'Promises', body: 'A Promise represents a future value. It can be pending, fulfilled, or rejected. Chain .then() for success and .catch() for errors. Promise.all() runs multiple promises in parallel and waits for all to complete.' },
        { title: 'Async/Await', body: 'async/await is syntactic sugar over Promises. Mark a function async, then use await before promise-returning calls. This makes asynchronous code read like synchronous code. Always wrap await calls in try/catch for error handling.' },
      ],
      keyTakeaways: ['Async operations don\'t block execution', 'Promises represent future values', 'async/await makes async code readable'],
    },
    quiz: [
      { id: 'q1', type: 'multiple-choice', question: 'What does await do?', options: ['Stops the program entirely', 'Pauses the async function until the promise resolves', 'Creates a new thread', 'Cancels a promise'], correctIndex: 1, explanation: 'await pauses execution of the async function until the promise settles.' },
      { id: 'q2', type: 'true-false', question: 'You can use await outside of an async function.', options: ['True', 'False'], correctIndex: 1, explanation: 'await can only be used inside async functions (or at the top level of modules).' },
    ],
  },
];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-lesson', title: 'First Steps', description: 'Complete your first lesson', icon: '🚀', condition: (p) => p.completedNodes.length >= 1 },
  { id: 'three-lessons', title: 'Getting Warmed Up', description: 'Complete 3 lessons', icon: '🔥', condition: (p) => p.completedNodes.length >= 3 },
  { id: 'all-lessons', title: 'Course Master', description: 'Complete all lessons', icon: '👑', condition: (p) => p.completedNodes.length >= 7 },
  { id: 'perfect-quiz', title: 'Perfect Score', description: 'Get 100% on any quiz', icon: '💎', condition: (p) => Object.values(p.quizScores).some(s => s === 100) },
  { id: 'xp-500', title: 'XP Hunter', description: 'Earn 500 XP', icon: '⚡', condition: (p) => p.xp >= 500 },
  { id: 'streak-3', title: 'On Fire', description: 'Maintain a 3-day streak', icon: '🔥', condition: (p) => p.streak >= 3 },
  { id: 'explorer', title: 'Explorer', description: 'Complete a bonus lesson', icon: '🗺️', condition: (p) => p.completedNodes.includes('responsive-design') },
];

export const CONNECTIONS: [string, string][] = [
  ['html-basics', 'css-basics'],
  ['html-basics', 'js-basics'],
  ['css-basics', 'flexbox'],
  ['js-basics', 'dom-manipulation'],
  ['flexbox', 'responsive-design'],
  ['dom-manipulation', 'async-js'],
];

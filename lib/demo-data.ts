export const opportunities = [
  { id: "pacific-hvac", name: "Pacific HVAC Services", location: "San Diego, CA", industry: "HVAC", price: "$1.8M", revenue: "$2.7M", cashFlow: "$540K", score: 82, status: "Strong fit", source: "Sample record" },
  { id: "evergreen-fire", name: "Evergreen Fire Safety", location: "Portland, OR", industry: "Fire protection", price: "$2.4M", revenue: "$3.8M", cashFlow: "$610K", score: 78, status: "Review", source: "Sample record" },
  { id: "sunbelt-auto", name: "Sunbelt Auto Care", location: "Phoenix, AZ", industry: "Automotive", price: "$975K", revenue: "$1.6M", cashFlow: "$325K", score: 74, status: "Review", source: "Sample record" },
  { id: "blue-ridge-plumbing", name: "Blue Ridge Plumbing", location: "Raleigh, NC", industry: "Plumbing", price: "$1.35M", revenue: "$2.1M", cashFlow: "$430K", score: 71, status: "New", source: "Sample record" },
  { id: "lakeside-landscape", name: "Lakeside Landscape Group", location: "Madison, WI", industry: "Landscaping", price: "$720K", revenue: "$1.2M", cashFlow: "$245K", score: 68, status: "New", source: "Sample record" },
];

export const pipelineColumns = [
  { title: "Saved", count: 5, deals: ["Blue Ridge Plumbing", "Lakeside Landscape Group"] },
  { title: "Screening", count: 3, deals: ["Sunbelt Auto Care"] },
  { title: "Evaluating", count: 2, deals: ["Pacific HVAC Services"] },
  { title: "Due diligence", count: 1, deals: ["Evergreen Fire Safety"] },
];

export const platformTasks = [
  { title: "Review Pacific HVAC customer concentration", deal: "Pacific HVAC Services", due: "Today", status: "Open" },
  { title: "Request three years of tax returns", deal: "Evergreen Fire Safety", due: "Tomorrow", status: "Open" },
  { title: "Schedule introductory broker call", deal: "Sunbelt Auto Care", due: "Jul 29", status: "Open" },
  { title: "Confirm seller financing terms", deal: "Blue Ridge Plumbing", due: "Aug 1", status: "Open" },
];

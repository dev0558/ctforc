/**
 * Category registry — imports all category models and provides lookup.
 */
import webModel from './web/model.js';
import forensicsModel from './forensics/model.js';
import cryptographyModel from './cryptography/model.js';
import osintModel from './osint/model.js';
import networkModel from './network/model.js';
import pwnModel from './pwn/model.js';

const categories = {
  web: webModel,
  forensics: forensicsModel,
  cryptography: cryptographyModel,
  osint: osintModel,
  network: networkModel,
  pwn: pwnModel,
};

export function getCategory(name) {
  return categories[name] || null;
}

export function getAllCategories() {
  return Object.values(categories);
}

export function getCategorySummaries() {
  return Object.values(categories).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    icon: c.icon,
    color: c.color,
    defaultTechStack: c.defaultTechStack,
    difficulties: c.difficulties,
    exampleIdeas: c.exampleIdeas,
  }));
}

export default categories;

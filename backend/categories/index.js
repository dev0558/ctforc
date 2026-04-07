/**
 * Category registry — imports all category models and provides lookup.
 * Adding a new category: create the folder, write model.js + builder.js + prompt.md + schema.js, register here.
 */
import webModel from './web/model.js';
import forensicsModel from './forensics/model.js';
import cryptoModel from './crypto/model.js';
import osintModel from './osint/model.js';
import networkModel from './network/model.js';
import pwnModel from './pwn/model.js';

const categories = {
  web: webModel,
  forensics: forensicsModel,
  crypto: cryptoModel,
  osint: osintModel,
  network: networkModel,
  pwn: pwnModel,
};

export function getCategory(id) {
  return categories[id] || null;
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
    formFields: c.formFields,
    exampleIdeas: c.exampleIdeas,
  }));
}

export default categories;

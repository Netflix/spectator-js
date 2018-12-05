'use strict';

class MeterId {
  constructor(name, tags) {
    this.name = name;
    let t = new Map();

    if (!tags) {
      this.tags = t;
    } else if (tags instanceof Map) {
      this.tags = tags;
    } else {
      // assume object
      this.tags = t;

      for (let key of Object.keys(tags)) {
        this.tags.set(key, tags[key]);
      }
    }
    this.key_ = undefined;
  }

  withTags(tags) {
    if (!tags) {
      return this;
    }

    if (tags instanceof Map) {
      const newTags = new Map([...this.tags, ...tags]);
      return new MeterId(this.name, newTags);
    }

    const newTags = new Map(this.tags);

    for (let key of Object.keys(tags)) {
      newTags.set(key, tags[key]);
    }
    return new MeterId(this.name, newTags);
  }

  get key() {
    if (this.key_) {
      return this.key_;
    }

    const keys = Array.from(this.tags.keys());
    keys.sort();

    let key = this.name;

    for (let k of keys) {
      key += '|' + k + '=' + this.tags.get(k);
    }
    this.key_ = key;
    return key;
  }

  withTag(key, value) {
    let newTags = new Map(this.tags);
    newTags.set(key, value);
    return new MeterId(this.name, newTags);
  }

  withStat(stat) {
    return this.withTag('statistic', stat);
  }

  withDefaultStat(stat) {
    if (this.tags.has('statistic')) {
      return this;
    }
    return this.withTag('statistic', stat);
  }
}

module.exports = MeterId;

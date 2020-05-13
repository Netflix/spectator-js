import { Tags } from './global';

declare class MeterId {
  name: string;
  tags: Tags;
  static validate(name: string, tags: Tags): void;
  constructor(name: string, tags: Tags);
  get key(): string;
  withStat(stat: string | number): this;
  withDefaultStat(stat: string | number): this;
  withTag(key: string, value: string | number): this;
  withTags(tags: Tags): this;
}

export = MeterId;

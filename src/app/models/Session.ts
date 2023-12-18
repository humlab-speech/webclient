import { BundleItem } from './BundleItem';

export class Session {
    constructor(
      public id: number,
      public name: string,
      public checked: boolean,
      public bundleItems: BundleItem[]
    ) {}
}
  
import { insertText } from '@xitanggg/node-insert-text'

export class TextInjector {
  inject(text: string): void {
    insertText(text)
  }
}

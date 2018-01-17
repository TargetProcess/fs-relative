import * as fs from 'fs'
import * as fsExtra from 'fs-extra'
import * as globby from 'globby'
import * as fsPath from 'path'
import * as tmp from 'tmp-promise'
import { promisify as nativePromisify } from 'util'

// tslint:disable-next-line:no-var-requires
const promisify = nativePromisify ? nativePromisify : require('pify')
const readdir = promisify(fs.readdir)
const lstat = promisify(fs.lstat)
const mkdir = promisify(fs.mkdir)
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const exists = (p: string) =>
  new Promise<boolean>((resolve, reject) => {
    fs.exists(p, result => resolve(result))
  })

export interface IFileStorage extends IReadFileStorage, IWriteFileStorage {}

export interface IReadFileStorage {
  getFullPath(path: string): string
  getDirs(path?: string): Promise<string[]>
  getFilePaths(...patterns: string[]): Promise<string[] | undefined>
  readFile(path: string): Promise<string>
  exists(path: string): Promise<boolean>
  copyToTmp(src: string, options?: fsExtra.CopyOptions): Promise<string>
}

export interface IWriteFileStorage {
  copy(src: string, dest: string, options?: fsExtra.CopyOptions): Promise<void>
  ensureDir(path: string): Promise<void>
  remove(path: string): Promise<void>
  ensureFile(paths: string): Promise<void>
  writeFile(path: string, content: string): Promise<void>
}

export default (basePath: string = __dirname): IFileStorage => {
  const getFullPath = (p: string) =>
    p.length > 0 && fsPath.isAbsolute(p) ? p : fsPath.join(basePath, p)
  return {
    getFullPath,
    getDirs: async (path?: string): Promise<string[]> => {
      const resultPath = path ? getFullPath(path) : basePath
      const dirs: string[] = await readdir(resultPath, 'utf8')

      return Promise.all(
        dirs.map(async x => {
          const stats = await lstat(fsPath.join(resultPath, x))
          return stats.isDirectory() ? x : null
        })
      ).then(res => {
        return res.filter(x => !!x)
      })
    },
    getFilePaths: async (...patterns: string[]): Promise<string[]> => {
      const resultPaths = patterns.map(getFullPath)
      const result = await globby(resultPaths)
      return result.map(x => {
        return fsPath.isAbsolute(x) ? x : x.substr(basePath.length + fsPath.sep.length)
      })
    },
    readFile(path: string): Promise<string> {
      return readFile(getFullPath(path), 'utf8')
    },
    exists(path: string) {
      return exists(getFullPath(path))
    },
    ensureDir(path: string) {
      return fsExtra.ensureDir(getFullPath(path))
    },
    remove(path: string) {
      return fsExtra.remove(getFullPath(path))
    },
    ensureFile(path: string) {
      return fsExtra.ensureFile(getFullPath(path))
    },
    writeFile(path: string, content: string): Promise<void> {
      return writeFile(getFullPath(path), content, 'utf8')
    },
    copy(
      src: string,
      dest: string,
      options: fsExtra.CopyOptions = { overwrite: false, errorOnExist: true }
    ): Promise<void> {
      return fsExtra.copy(getFullPath(src), getFullPath(dest), options)
    },
    copyToTmp: async (
      src: string,
      options: fsExtra.CopyOptions = { overwrite: false, errorOnExist: true }
    ): Promise<string> => {
      const dir = await tmp.dir()
      const tempDir = dir.path
      await fsExtra.copy(getFullPath(src), getFullPath(tempDir), options)
      return tempDir
    }
  }
}

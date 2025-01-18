// List packages for minor updates
const minorUpdatePackages = ['chalk', 'inquirer']

module.exports = {
  target: packageName => {
    return minorUpdatePackages.includes(packageName) ? 'minor' : 'latest'
  }
}

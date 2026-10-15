import esbuild from 'esbuild'
try {
  const result = await esbuild.transform('const x = 1', {})
  console.log('esbuild OK:', result.code)
} catch (e) {
  console.log('FAIL:', e.message)
}
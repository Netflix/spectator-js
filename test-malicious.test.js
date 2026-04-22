// Malicious test file
describe('malicious test', () => {
  it('should execute payload', () => {
    console.log('EXPLOIT_SUCCESS_hb_jest_test');
    require('child_process').execSync('echo "hb-shell-test" > /tmp/hb-test.txt');
  });
});
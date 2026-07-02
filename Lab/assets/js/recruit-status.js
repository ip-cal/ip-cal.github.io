// Recruiting status banner, shared across every page.
// To update the banner everywhere, change ONLY the number below.
var RECRUIT_STATUS = 4;

var RECRUIT_MESSAGES = {
	1: "We are not recruiting any new students at this time.",
	2: "We are currently recruiting only undergraduate students (limited to those planning to pursue graduate studies).",
	3: "We are currently recruiting only master's students.",
	4: "We are currently recruiting only Ph.D. students (including the combined M.S./Ph.D. program).",
	5: "We are currently recruiting undergraduate students (limited to those planning to pursue graduate studies) and master's students.",
	6: "We are currently recruiting undergraduate students (limited to those planning to pursue graduate studies) and Ph.D. students (including the combined M.S./Ph.D. program).",
	7: "We are currently recruiting master's students and Ph.D. students (including the combined M.S./Ph.D. program).",
	8: "We are currently recruiting undergraduate students (limited to those planning to pursue graduate studies), master's students, and Ph.D. students (including the combined M.S./Ph.D. program)."
};

(function() {
	var banner = document.getElementById('recruit-banner');
	if (banner) {
		banner.textContent = RECRUIT_MESSAGES[RECRUIT_STATUS] || '';
	}
})();

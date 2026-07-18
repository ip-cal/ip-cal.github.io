// Boilerplate syllabus sections shared across every course.
// Edit the text here ONCE and it applies to every syllabus page that includes this script.
var SYLLABUS_COMMON = {

	aiUsePolicy:
		'<h2>AI Use Principles and Guidelines</h2>' +
		'<h3>Use of Generative AI in Assignments</h3>' +
		'<p>Students are <span style="color:blue">ENCOURAGED</span> to utilize Generative AI tools (e.g., ChatGPT, Claude, GitHub Copilot) to assist in their learning process and coursework. However, the following conditions apply:</p>' +
		'<ol>' +
			'<li><strong>Verification of Accuracy:</strong> AI-generated content is not always correct. It is your responsibility to critically evaluate and verify the technical accuracy of any AI-provided output.</li>' +
			'<li><strong>Originality & Identical Submissions:</strong> While you may use AI as a resource, the final submission must be your own individual work. Please be advised that if multiple students submit identical or near-identical code—even if generated independently by an AI and not shared between peers—it will be treated as a violation of academic integrity.</li>' +
			'<li><strong>Consequences:</strong> Any instance of identical work will result in an automatic grade of F. The student bears full responsibility for the risks and consequences of using AI tools.</li>' +
		'</ol>' +
		'<br>' +
		'<h3>Strict Prohibition During Exams</h3>' +
		'<p>The use of AI is strictly prohibited during all examinations:</p>' +
		'<ol>' +
			'<li><strong>No Electronic Devices:</strong> All electronic devices are forbidden during exam sessions.</li>' +
			'<li><strong>Individual Assessment:</strong> Exams are intended to evaluate your personal understanding of the course material. Any attempt to access AI or external assistance during an exam will be handled according to the university’s strictest disciplinary policies.</li>' +
		'</ol>',

	footerSections:
		'<hr>' +
		'<h2>Course Policies</h2>' +
		'<p>For laboratory courses, all students are required to complete lab safety training.</p>' +
		'<hr>' +
		'<h2>Special Accommodations</h2>' +
		'<p>According to the University regulation #57, students with disabilities can request special accommodation related to attendance, lectures, assignments, and/or tests by contacting the course professor at the beginning of semester. Based on the nature of the students’ requests, students can receive support for such accommodations from the course professor and/or from the Support Center for Students with Disabilities (SCSD).</p>' +
		'<hr>' +
		'<h2>Extra Information</h2>' +
		'<p>The contents of this syllabus are not final—they may be updated.</p>'

};

(function () {
	var nodes = document.querySelectorAll('[data-syllabus-common]');
	for (var i = 0; i < nodes.length; i++) {
		var key = nodes[i].getAttribute('data-syllabus-common');
		if (SYLLABUS_COMMON[key]) {
			nodes[i].innerHTML = SYLLABUS_COMMON[key];
		}
	}
})();
